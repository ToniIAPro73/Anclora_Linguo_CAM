#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path
from urllib.request import urlopen

DEFAULT_MANIFEST = Path('runtime/models-manifest.json')


def load_manifest(path: Path) -> dict:
    if not path.exists():
        return {"models": []}
    with path.open('r', encoding='utf-8') as handle:
        return json.load(handle)


def save_manifest(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8') as handle:
        json.dump(data, handle, indent=2, ensure_ascii=True)
        handle.write('\n')


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def cmd_list(args: argparse.Namespace) -> int:
    manifest = load_manifest(args.manifest)
    for item in manifest.get('models', []):
        print(f"{item.get('name')}@{item.get('version')} -> {item.get('path')} [{item.get('sha256')}]")
    return 0


def cmd_verify(args: argparse.Namespace) -> int:
    manifest = load_manifest(args.manifest)
    failed = False
    for item in manifest.get('models', []):
        model_path = Path(item['path'])
        expected = item.get('sha256', '').lower()
        if not model_path.exists():
            print(f"MISSING {model_path}")
            failed = True
            continue
        actual = sha256_file(model_path)
        if expected and actual != expected:
            print(f"BADSUM {model_path} expected={expected} actual={actual}")
            failed = True
            continue
        print(f"OK {model_path}")
    return 1 if failed else 0


def cmd_download(args: argparse.Namespace) -> int:
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    with urlopen(args.url) as response:
        data = response.read()
    with output.open('wb') as handle:
        handle.write(data)

    actual = sha256_file(output)
    expected = args.sha256.lower().strip()
    if expected and actual != expected:
        output.unlink(missing_ok=True)
        print(f"checksum mismatch expected={expected} actual={actual}", file=sys.stderr)
        return 1

    manifest = load_manifest(args.manifest)
    models = manifest.setdefault('models', [])
    models = [m for m in models if not (m.get('name') == args.name and m.get('version') == args.version)]
    models.append(
        {
            'name': args.name,
            'version': args.version,
            'path': str(output),
            'sha256': actual,
            'source_url': args.url,
            'updated_at_epoch': int(time.time()),
        }
    )
    manifest['models'] = models
    save_manifest(args.manifest, manifest)

    print(f"downloaded {args.name}@{args.version} -> {output}")
    print(f"sha256={actual}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='Model artifact manager (version + checksum).')
    parser.add_argument('--manifest', type=Path, default=DEFAULT_MANIFEST)
    sub = parser.add_subparsers(dest='command', required=True)

    list_parser = sub.add_parser('list', help='List models from manifest')
    list_parser.set_defaults(fn=cmd_list)

    verify_parser = sub.add_parser('verify', help='Verify local files vs manifest checksum')
    verify_parser.set_defaults(fn=cmd_verify)

    dl_parser = sub.add_parser('download', help='Download model, verify checksum and register')
    dl_parser.add_argument('--name', required=True)
    dl_parser.add_argument('--version', required=True)
    dl_parser.add_argument('--url', required=True)
    dl_parser.add_argument('--output', required=True)
    dl_parser.add_argument('--sha256', required=False, default='')
    dl_parser.set_defaults(fn=cmd_download)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return int(args.fn(args))


if __name__ == '__main__':
    raise SystemExit(main())
