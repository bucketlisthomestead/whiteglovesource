#!/usr/bin/env bash
# Build native pgloader on x86_64 Amazon Linux 2023 (Docker image SSL is broken for RDS).
set -euo pipefail

if command -v pgloader >/dev/null 2>&1 && pgloader --version >/dev/null 2>&1; then
  echo "pgloader already installed: $(pgloader --version | head -1)"
  exit 0
fi

echo "Installing build dependencies ..."
dnf install -y gcc gcc-c++ make git bzip2 openssl-devel mariadb105-devel postgresql15-devel freetds-devel

if ! command -v sbcl >/dev/null 2>&1; then
  SBCL_VER="2.4.11"
  SBCL_TAR="sbcl-${SBCL_VER}-x86-64-linux-binary.tar.bz2"
  echo "Installing SBCL ${SBCL_VER} ..."
  curl -fsSL "https://downloads.sourceforge.net/project/sbcl/sbcl/${SBCL_VER}/${SBCL_TAR}" -o "/tmp/${SBCL_TAR}"
  rm -rf "/tmp/sbcl-${SBCL_VER}-x86-64-linux"
  tar -xjf "/tmp/${SBCL_TAR}" -C /tmp
  (cd "/tmp/sbcl-${SBCL_VER}-x86-64-linux" && sh install.sh --prefix=/usr/local)
fi

BUILD_DIR="/tmp/pgloader-src"
rm -rf "$BUILD_DIR"
echo "Cloning pgloader v3.6.9 ..."
git clone --depth 1 --branch v3.6.9 https://github.com/dimitri/pgloader.git "$BUILD_DIR"
cd "$BUILD_DIR"
echo "Building pgloader (5–15 min on t3.small) ..."
make pgloader DYNSIZE=8192
install -m 755 build/bin/pgloader /usr/local/bin/pgloader
echo "Installed: $(pgloader --version | head -1)"
