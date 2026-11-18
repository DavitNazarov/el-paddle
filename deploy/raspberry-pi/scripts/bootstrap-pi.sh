#!/usr/bin/env bash
# One-time Raspberry Pi host setup for El Padel backend.
# Run as a sudo-capable user on Debian 12 (bookworm) arm64.
# Idempotent: safe to re-run.
#
#   curl/scp this script onto the Pi, then:
#   sudo ./bootstrap-pi.sh

set -euo pipefail

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { printf '%s ERROR: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; exit 1; }

[[ "$(id -u)" -eq 0 ]] || die "Run as root (sudo ./bootstrap-pi.sh)."

TARGET_USER="${SUDO_USER:-${DEPLOY_USER:-pi}}"
if ! id "${TARGET_USER}" >/dev/null 2>&1; then
  die "Target user '${TARGET_USER}' does not exist."
fi

export DEBIAN_FRONTEND=noninteractive

log "Installing base packages"
apt-get update -y
apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  ufw \
  unattended-upgrades \
  apt-listchanges \
  rsync \
  jq

log "Configuring unattended-upgrades (security updates)"
apt-get install -y unattended-upgrades
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

log "Enabling NTP (systemd-timesyncd)"
timedatectl set-ntp true || true

# --- Swap: raise to 2 GB ---
if command -v dphys-swapfile >/dev/null 2>&1; then
  log "Raising dphys-swapfile CONF_SWAPSIZE to 2048"
  if [[ -f /etc/dphys-swapfile ]]; then
    if grep -q '^CONF_SWAPSIZE=' /etc/dphys-swapfile; then
      sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
    else
      echo 'CONF_SWAPSIZE=2048' >>/etc/dphys-swapfile
    fi
    dphys-swapfile swapoff || true
    dphys-swapfile setup
    dphys-swapfile swapon
  fi
else
  log "dphys-swapfile not present; ensuring a 2G /swapfile"
  if [[ ! -f /swapfile ]]; then
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  if ! grep -q '^/swapfile ' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >>/etc/fstab
  fi
  swapon /swapfile || true
fi

log "Setting vm.swappiness=10"
cat >/etc/sysctl.d/99-elpadel-swap.conf <<'EOF'
vm.swappiness=10
EOF
sysctl --system >/dev/null

# --- Docker Engine from Docker's official Debian bookworm apt repo ---
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker Engine + compose plugin (official Docker apt repo)"
  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  fi
  ARCH="$(dpkg --print-architecture)"
  # VERSION_CODENAME comes from the Pi's os-release (Debian bookworm).
  # shellcheck source=/dev/null
  CODENAME="$(. /etc/os-release && echo "${VERSION_CODENAME}")"
  echo \
    "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian ${CODENAME} stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  log "Docker already installed: $(docker --version)"
fi

systemctl enable --now docker

log "Adding ${TARGET_USER} to docker group"
usermod -aG docker "${TARGET_USER}"

log "Creating /srv/elpadel/{pgdata,backups,state}"
install -d -o "${TARGET_USER}" -g "${TARGET_USER}" -m 755 /srv/elpadel
install -d -o "${TARGET_USER}" -g "${TARGET_USER}" -m 700 /srv/elpadel/pgdata
install -d -o "${TARGET_USER}" -g "${TARGET_USER}" -m 700 /srv/elpadel/backups
install -d -o "${TARGET_USER}" -g "${TARGET_USER}" -m 755 /srv/elpadel/state

# --- UFW: default deny inbound; SSH from LAN + Tailscale ---
log "Configuring ufw (SSH from LAN 10.0.0.0/8 and Tailscale 100.64.0.0/10)"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
# LAN (adjust if your LAN is not RFC1918 10/8 — common for this Pi inventory)
ufw allow from 10.0.0.0/8 to any port 22 proto tcp comment 'SSH LAN'
ufw allow from 172.16.0.0/12 to any port 22 proto tcp comment 'SSH LAN private'
ufw allow from 192.168.0.0/16 to any port 22 proto tcp comment 'SSH LAN home'
ufw allow from 100.64.0.0/10 to any port 22 proto tcp comment 'SSH Tailscale'
ufw --force enable

log "NOTE: Docker-published ports bypass ufw. This stack publishes none — keep it that way."

log "Bootstrap complete."
log "Log out and back in (or newgrp docker) so group membership applies."
log "Next: copy deploy/raspberry-pi to the Pi, create .env, then run scripts/deploy.sh <image-tag>."
