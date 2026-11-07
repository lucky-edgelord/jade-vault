#!/usr/bin/env python3
"""Jade Vault backup server: a tiny REST API that stores the backups Jade Vault uploads.

Standard library only (Python 3.9+). Run it on a machine that is always on (a Raspberry Pi, a NAS, a spare PC):

    python3 jade-backup-server.py --init                  # makes ./jade-backup.token (a long random token) and ./backups/
    python3 jade-backup-server.py                         # serves on 0.0.0.0:8787

Then in Jade Vault: Settings → Backup → "Scheduled backup to a server":
    Server address   http://<this machine>:8787
    Token            the contents of jade-backup.token

API (every route except /health needs   Authorization: Bearer <token>):
    GET    /health                 -> {"ok": true}                     (no token; so you can check the server is up)
    GET    /backups                -> {"backups": [{"name","size","sha256","modified"}], "total_bytes": n}
    PUT    /backups/<name>         -> store the request body as <name>; send  X-Sha256: <hex>  and the server verifies it
    GET    /backups/<name>         -> download it
    DELETE /backups/<name>         -> remove it
  <name> is letters, digits, dot, dash and underscore, ends in .json or .json.gz, at most 128 characters.

Safety:
  * The token is compared in constant time. After a wrong token the server waits a second before answering.
  * Files are written to a temporary name, checked against X-Sha256, then moved into place. A failed or cut-off
    upload never replaces a good backup.
  * Names cannot contain a slash or "..", so nothing is ever written outside the backup folder.
  * Uploads are limited in size (--max-mb), and the oldest backups are deleted so only the newest --keep remain
    (counted per kind: "full" and "config" separately).
  * Plain HTTP sends the token and the backup in clear text. On a home network that may be fine; otherwise put it behind
    a TLS reverse proxy (Caddy, nginx) or use --tls-cert / --tls-key. A backup made with "Encrypt" in the app is encrypted
    before it leaves the phone, so the server never sees its contents.
  * Backups hold your notes, chats and memory. Keep the folder private (the server makes it mode 700).

Run it at boot (systemd): see docs/backup-server.md.
"""
import argparse, hashlib, hmac, json, os, re, secrets, ssl, sys, tempfile, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

NAME_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$')
KIND_RE = re.compile(r'^(jade-vault-(?:full|config|backup))')
CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Sha256',
        'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS', 'Access-Control-Max-Age': '600'}


def valid_name(name):
    return bool(NAME_RE.match(name)) and '..' not in name and (name.endswith('.json') or name.endswith('.json.gz'))


class Store:
    def __init__(self, root, keep, max_bytes):
        self.root, self.keep, self.max_bytes = os.path.abspath(root), keep, max_bytes
        self.lock = threading.Lock()
        os.makedirs(self.root, mode=0o700, exist_ok=True)
        try: os.chmod(self.root, 0o700)
        except OSError: pass

    def path(self, name):
        p = os.path.join(self.root, name)
        if os.path.dirname(os.path.abspath(p)) != self.root: raise ValueError('bad name')
        return p

    def sha(self, p):
        h = hashlib.sha256()
        with open(p, 'rb') as f:
            for chunk in iter(lambda: f.read(1 << 20), b''): h.update(chunk)
        return h.hexdigest()

    def list(self):
        out = []
        for n in os.listdir(self.root):
            p = os.path.join(self.root, n)
            if valid_name(n) and os.path.isfile(p):
                st = os.stat(p); out.append({'name': n, 'size': st.st_size, 'modified': int(st.st_mtime), 'sha256': self.sha(p)})
        out.sort(key=lambda x: (x['modified'], x['name']), reverse=True)
        return out

    def prune(self):
        groups = {}
        for b in self.list():
            m = KIND_RE.match(b['name']); groups.setdefault(m.group(1) if m else '_', []).append(b)
        removed = []
        for items in groups.values():
            for b in items[self.keep:]:
                try: os.remove(self.path(b['name'])); removed.append(b['name'])
                except OSError: pass
        return removed


def make_handler(store, token, log):
    class H(BaseHTTPRequestHandler):
        server_version = 'JadeBackup/1'
        protocol_version = 'HTTP/1.1'

        def log_message(self, fmt, *a):
            if log: sys.stderr.write('%s %s\n' % (self.address_string(), fmt % a))

        def send(self, code, body=b'', ctype='application/json', extra=None):
            if isinstance(body, (dict, list)): body = json.dumps(body).encode()
            self.send_response(code)
            for k, v in {**CORS, **(extra or {})}.items(): self.send_header(k, v)
            self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store'); self.end_headers()
            if self.command != 'HEAD': self.wfile.write(body)

        def authed(self):
            got = self.headers.get('Authorization', '')
            if got.startswith('Bearer ') and hmac.compare_digest(got[7:].strip().encode(), token.encode()): return True
            time.sleep(1); self.send(401, {'error': 'missing or wrong token'}, extra={'WWW-Authenticate': 'Bearer'}); return False

        def route(self):
            parts = [unquote(x) for x in urlparse(self.path).path.strip('/').split('/') if x]
            return parts

        def do_OPTIONS(self): self.send(204)

        def do_GET(self):
            parts = self.route()
            if parts == ['health']: return self.send(200, {'ok': True})
            if not self.authed(): return
            if parts == ['backups']:
                items = store.list(); return self.send(200, {'backups': items, 'total_bytes': sum(i['size'] for i in items), 'keep': store.keep})
            if len(parts) == 2 and parts[0] == 'backups':
                if not valid_name(parts[1]): return self.send(400, {'error': 'bad name'})
                p = store.path(parts[1])
                if not os.path.isfile(p): return self.send(404, {'error': 'no such backup'})
                with open(p, 'rb') as f: data = f.read()
                return self.send(200, data, 'application/octet-stream', {'X-Sha256': hashlib.sha256(data).hexdigest()})
            self.send(404, {'error': 'not found'})

        def do_DELETE(self):
            parts = self.route()
            if not self.authed(): return
            if len(parts) == 2 and parts[0] == 'backups' and valid_name(parts[1]):
                p = store.path(parts[1])
                if not os.path.isfile(p): return self.send(404, {'error': 'no such backup'})
                os.remove(p); return self.send(200, {'deleted': parts[1]})
            self.send(404, {'error': 'not found'})

        def do_PUT(self):
            parts = self.route()
            if not self.authed(): return
            if not (len(parts) == 2 and parts[0] == 'backups'): return self.send(404, {'error': 'not found'})
            name = parts[1]
            if not valid_name(name): return self.send(400, {'error': 'bad name: letters, digits . _ - only, ending in .json or .json.gz'})
            try: n = int(self.headers.get('Content-Length', ''))
            except ValueError: return self.send(411, {'error': 'Content-Length is required'})
            if n <= 0: return self.send(400, {'error': 'empty upload'})
            if n > store.max_bytes:
                self.close_connection = True; return self.send(413, {'error': f'too large: {n} bytes, the limit is {store.max_bytes}'})
            want = (self.headers.get('X-Sha256') or '').strip().lower()
            fd, tmp = tempfile.mkstemp(prefix='.upload-', dir=store.root); h = hashlib.sha256(); got = 0
            try:
                with os.fdopen(fd, 'wb') as f:
                    while got < n:
                        chunk = self.rfile.read(min(1 << 20, n - got))
                        if not chunk: break
                        f.write(chunk); h.update(chunk); got += len(chunk)
                # a refused upload is deleted before the answer goes out, so "nothing was stored" is already true when the client reads it
                if got != n:
                    os.remove(tmp); tmp = None
                    self.close_connection = True; return self.send(400, {'error': f'upload cut off after {got} of {n} bytes; nothing was stored'})
                if want and not hmac.compare_digest(want, h.hexdigest()):
                    os.remove(tmp); tmp = None
                    return self.send(422, {'error': 'checksum mismatch; nothing was stored', 'sha256': h.hexdigest()})
                with store.lock:
                    os.replace(tmp, store.path(name)); tmp = None
                    try: os.chmod(store.path(name), 0o600)
                    except OSError: pass
                    removed = store.prune()
                self.send(201, {'stored': name, 'size': n, 'sha256': h.hexdigest(), 'pruned': removed})
            finally:
                if tmp and os.path.exists(tmp):
                    try: os.remove(tmp)
                    except OSError: pass
    return H


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):          # a client that hangs up mid-request is not worth a traceback
        if isinstance(sys.exc_info()[1], (BrokenPipeError, ConnectionResetError, TimeoutError)): return
        super().handle_error(request, client_address)


def make_server(host, port, root, token, keep=30, max_mb=1024, tls=None, log=False):
    store = Store(root, keep, int(max_mb * 1024 * 1024))
    srv = Server((host, port), make_handler(store, token, log))
    if tls:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.load_cert_chain(*tls); srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
    srv.store = store
    return srv


def main():
    ap = argparse.ArgumentParser(description='Jade Vault backup server')
    ap.add_argument('--host', default=os.environ.get('JADE_BACKUP_HOST', '0.0.0.0'))
    ap.add_argument('--port', type=int, default=int(os.environ.get('JADE_BACKUP_PORT', '8787')))
    ap.add_argument('--dir', default=os.environ.get('JADE_BACKUP_DIR', './backups'), help='where backups are stored')
    ap.add_argument('--token-file', default=os.environ.get('JADE_BACKUP_TOKEN_FILE', './jade-backup.token'))
    ap.add_argument('--keep', type=int, default=int(os.environ.get('JADE_BACKUP_KEEP', '30')), help='newest backups to keep, per kind')
    ap.add_argument('--max-mb', type=float, default=float(os.environ.get('JADE_BACKUP_MAX_MB', '1024')))
    ap.add_argument('--tls-cert'); ap.add_argument('--tls-key')
    ap.add_argument('--init', action='store_true', help='create the token file and the backup folder, print the token, and exit')
    ap.add_argument('--quiet', action='store_true')
    a = ap.parse_args()
    if a.init:
        if os.path.exists(a.token_file): print(f'{a.token_file} already exists; keeping it.'); return
        tok = secrets.token_urlsafe(32)
        fd = os.open(a.token_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as f: f.write(tok + '\n')
        os.makedirs(a.dir, mode=0o700, exist_ok=True)
        print(f'Token saved to {a.token_file} (keep it private). Paste this into Jade Vault:\n\n{tok}\n'); return
    token = os.environ.get('JADE_BACKUP_TOKEN') or (open(a.token_file).read().strip() if os.path.exists(a.token_file) else '')
    if len(token) < 20: sys.exit('No usable token. Run with --init first (or set JADE_BACKUP_TOKEN to something long and random).')
    if bool(a.tls_cert) != bool(a.tls_key): sys.exit('--tls-cert and --tls-key go together')
    srv = make_server(a.host, a.port, a.dir, token, a.keep, a.max_mb, (a.tls_cert, a.tls_key) if a.tls_cert else None, not a.quiet)
    print(f'Jade backup server on {"https" if a.tls_cert else "http"}://{a.host}:{a.port}  folder {srv.store.root}  keeping {a.keep} per kind', flush=True)
    try: srv.serve_forever()
    except KeyboardInterrupt: print('bye')


if __name__ == '__main__':
    main()
