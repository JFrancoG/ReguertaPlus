#!/usr/bin/env python3
"""Local TLS rejection oracle; its generated certificate is outside the QA trust store."""

import http.server
import ssl
import subprocess
import tempfile
from pathlib import Path


class UnexpectedRequest(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        # A QA client must reject the handshake before any HTTP request reaches here.
        print("FAIL: HTTP reached the untrusted local TLS server", flush=True)
        self.send_error(500, "QA TLS isolation failed")

    def log_message(self, *_args):
        pass


def main():
    with tempfile.TemporaryDirectory(prefix="hu090-negative-tls-") as directory:
        certificate = Path(directory) / "certificate.pem"
        private_key = Path(directory) / "private-key.pem"
        subprocess.run(
            [
                "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
                "-keyout", str(private_key), "-out", str(certificate), "-days", "1",
                "-subj", "/CN=10.0.2.2", "-addext", "subjectAltName=IP:10.0.2.2",
            ],
            check=True,
            timeout=20,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(certificate, private_key)
        with http.server.ThreadingHTTPServer(("127.0.0.1", 5998), UnexpectedRequest) as server:
            server.socket = context.wrap_socket(server.socket, server_side=True)
            print("HU090 negative TLS oracle listening only on 127.0.0.1:5998", flush=True)
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                pass


if __name__ == "__main__":
    main()
