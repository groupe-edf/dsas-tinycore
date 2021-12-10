#!/bin/sh
/usr/local/sbin/saslauthd -a shadow &

if [ -n "/home/dsas/bas/share/ClamAV" ]; then
  mkdir -p /home/dsas/bas/share/ClamAV
  chown verif.share /home/dsas/dsas/share/ClamAV
fi
sudo -u verif /usr/local/sbin/clamd &
