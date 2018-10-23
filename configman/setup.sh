#!/bin/bash
yarn
git clone https://git.dn42.us/dn42/registry
mkdir -p /etc/bird/peers
mkdir -p /etc/bird/wireguard
cp -r extras/wireguard/* /etc/bird/wireguard/
cp extras/sync-config ~/bin/sync-config
systemctl enable /etc/bird/wireguard/wireguard.service

echo "Now, configure data.yml, then run 'sync-config'"