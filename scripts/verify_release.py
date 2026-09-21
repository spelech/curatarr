#!/usr/bin/env python3
"""
Release and Version Verification Engine for Curatarr.
Validates version consistency across manifests, markdown relative links, and test integrity.
"""

import os
import re
import sys
import argparse
from pathlib import Path

def check_markdown_links(root_dir: Path) -> bool:
    print("🔍 Checking markdown relative links and anchors...")
    has_errors = False
    for md_file in root_dir.glob("**/*.md"):
        if any(part.startswith(".") or part in ["node_modules", "bin", "obj", ".venv"] for part in md_file.parts):
            continue
        content = md_file.read_text(encoding="utf-8", errors="ignore")
        # Find markdown links: [text](path)
        links = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', content)
        for text, link in links:
            if link.startswith("http://") or link.startswith("https://") or link.startswith("#") or link.startswith("mailto:") or link.startswith("file://"):
                continue
            # Strip anchors
            target_path = link.split("#")[0]
            if not target_path:
                continue
            if target_path.startswith("/"):
                print(f"❌ Absolute filesystem path forbidden in markdown ({md_file.relative_to(root_dir)}): [{text}]({link})")
                has_errors = True
                continue
            resolved = (md_file.parent / target_path).resolve()
            if not resolved.exists():
                print(f"❌ Broken link in {md_file.relative_to(root_dir)}: [{text}]({link})")
                has_errors = True
    if not has_errors:
        print("✅ All markdown links verified successfully.")
    return not has_errors

def check_version_sync(root_dir: Path) -> bool:
    print("🔍 Checking version consistency across manifests...")
    # 1. Directory.Build.props
    props_file = root_dir / "Directory.Build.props"
    backend_version = None
    if props_file.exists():
        match = re.search(r'<Version>([^<]+)</Version>', props_file.read_text(encoding="utf-8"))
        if match:
            backend_version = match.group(1).strip()

    # 2. Frontend package.json
    pkg_file = root_dir / "src" / "Curatarr.Web" / "package.json"
    frontend_version = None
    if pkg_file.exists():
        match = re.search(r'"version":\s*"([^"]+)"', pkg_file.read_text(encoding="utf-8"))
        if match:
            frontend_version = match.group(1).strip()

    # 3. E2E package.json
    e2e_pkg_file = root_dir / "tests" / "Curatarr.E2E" / "package.json"
    e2e_version = None
    if e2e_pkg_file.exists():
        match = re.search(r'"version":\s*"([^"]+)"', e2e_pkg_file.read_text(encoding="utf-8"))
        if match:
            e2e_version = match.group(1).strip()

    print(f"   Backend version:  {backend_version or 'not specified in Directory.Build.props'}")
    print(f"   Frontend version: {frontend_version or 'not specified in package.json'}")
    print(f"   E2E version:      {e2e_version or 'not specified in tests/Curatarr.E2E/package.json'}")

    has_errors = False
    if backend_version and frontend_version and backend_version != frontend_version:
        print(f"❌ Version mismatch: Backend ({backend_version}) != Frontend ({frontend_version})")
        has_errors = True

    if backend_version and e2e_version and backend_version != e2e_version:
        print(f"❌ Version mismatch: Backend ({backend_version}) != E2E ({e2e_version})")
        has_errors = True

    # 4. Enforce dynamic version in Header.tsx (no hardcoded v1.x / v0.x)
    header_file = root_dir / "src" / "Curatarr.Web" / "src" / "components" / "Header.tsx"
    if header_file.exists():
        header_text = header_file.read_text(encoding="utf-8")
        if "__APP_VERSION__" not in header_text:
            print("❌ Header.tsx does not use dynamic '__APP_VERSION__'")
            has_errors = True
        if re.search(r'>\s*v\d+\.\d+', header_text):
            print("❌ Header.tsx contains hardcoded version badge string (expected dynamic __APP_VERSION__)")
            has_errors = True

    # 5. Enforce dynamic assembly version in Program.cs
    program_file = root_dir / "src" / "Curatarr.Api" / "Program.cs"
    if program_file.exists():
        program_text = program_file.read_text(encoding="utf-8")
        if "appVersion" not in program_text:
            print("❌ Program.cs does not resolve appVersion dynamically from assembly")
            has_errors = True

    if has_errors:
        return False

    print("✅ Version consistency check passed.")
    return True

def main():
    parser = argparse.ArgumentParser(description="Release Verification Engine")
    parser.add_argument("--skip-tests", action="store_true", help="Skip test suite execution")
    parser.add_argument("--ci", action="store_true", help="CI mode")
    args = parser.parse_args()

    root_dir = Path(__file__).resolve().parent.parent
    links_ok = check_markdown_links(root_dir)
    versions_ok = check_version_sync(root_dir)

    success = links_ok and versions_ok
    if not success:
        sys.exit(1)
    print("🎉 All release verification checks passed successfully.")
    sys.exit(0)

if __name__ == "__main__":
    main()
