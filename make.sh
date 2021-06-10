#! /bin/sh

# Force to run as root
if [ $(id -u) != 0 ]; then
  sudo -E $0 $* 
  exit $?
fi

cd $(dirname "$0")

# Get architecture
if [ `uname -m` ]; then
  arch=64
else
  arch=32
fi

# tiny core related
# http://distro.ibiblio.org/tinycorelinux/downloads.html
if [ "$arch" -eq "64" ]; then
  livecd_url=http://tinycorelinux.net/12.x/x86/release/Core-current.iso
  tcz_url=http://tinycorelinux.net/12.x/x86/tcz
else
  livecd_url=http://tinycorelinux.net/12.x/x86_64/release/CorePure64-current.iso
  tcz_url=http://tinycorelinux.net/12.x/x86_64/tcz
fi

# internally used dirs and paths
work=./work
append=./append
tcz_dir=$work/tcz
whl_dir=$work/whl
livecd0=$work/livecd.iso
dsascd=$work/dsas.iso
mnt=$work/mnt
extract=$work/extract
newiso=$work/newiso
squashfs=$newiso/boot/core.gz
levels=./levels
work_levels=$work/levels
cert_dir=$work/cert
service_pass_len=8
src=./src

mscrtfiles="https://www.microsoft.com/pki/certs/MicRooCerAut_2010-06-23.crt \
          https://www.microsoft.com/pki/certs/MicRooCerAut2011_2011_03_22.crt \
          https://www.microsoft.com/pkiops/certs/Microsoft%20Time%20Stamp%20Root%20Certificate%20Authority%202014.crt \
          https://www.microsoft.com/pkiops/certs/Microsoft%20ECC%20Product%20Root%20Certificate%20Authority%202018.crt \
          https://www.microsoft.com/pkiops/certs/Microsoft%20ECC%20TS%20Root%20Certificate%20Authority%202018.crt"

symcrtfiles=""


test "$SUDO_USER" && as_user="sudo -E -u $SUDO_USER" || as_user=

msg() {
    echo '[*]' $*
}

cmd() {
    echo '[cmd]' $*
    $*
}

error() {
    echo '[E]' $*
    exit 1
}

exit_if_nonroot() {
    test $(id -u) = 0 || error this script needs to run as root
}
 
pwgen() {
    pass=`< /dev/random tr -dc _A-Z-a-z-0-9 | head -c$1;echo;`
}

get_tcz() {
    $as_user mkdir -pv $tcz_dir
    for package; do
        target=$tcz_dir/$package.tcz
        if test ! -f $target; then
            msg fetching package $package ...
            $as_user curl -o $target $tcz_url/$package.tcz
        fi
        dep=$target.dep
        if test ! -f $dep; then
            msg fetching dep list of $package ...
            $as_user curl -o $dep $tcz_url/$package.tcz.dep || touch $dep
            grep -q 404 $dep && >$dep
            if test -s $dep; then
                get_tcz $(sed -e s/.tcz$// $dep)
            fi
        fi
    done
}

install_tcz() {
    get_tcz $@
    exit_if_nonroot
    for package; do
        target=$tcz_dir/$package.tcz
        tce_marker=$extract/usr/local/tce.installed/$package
        if ! test -f $tce_marker; then
            msg installing package $package ...
            unsquashfs -f -d $extract $target
            if test -s $tce_marker; then
                msg post-install script $package
                chroot $extract env LD_LIBRARY_PATH=/usr/local/lib /usr/local/tce.installed/$package
            else
                touch $tce_marker
            fi
        fi
        dep=$target.dep
        if test -s $dep; then
            install_tcz $(sed -e s/.tcz$// $dep)
        fi
    done
}

getcrt() {
    for crt; do
        target=$cert_dir/`basename $crt | sed -e "s/%20/ /g"`
	msg download certificate $target
        if test ! -f "$target"; then
            $as_user curl -o "$target" $crt
        fi
    done
}

crt2pem() {
    for crt0; do
        crt=$cert_dir/`basename $crt0 | sed -e "s/%20/ /g"`
        target=$pemdest/`basename $crt0 | sed -e "s/%20/ /g"`
        msg create PEM file of ""`basename $crt0 | sed -e 's/%20/ /g'`
        openssl x509 -inform DER -outform PEM -in "$crt" -out "$target"
    done
}

# create a personalised ca-certificate package, with
# only the authorised certificated installed
create_certs() {
    get_tcz ca-certificates
    extract0=$work/tmpcert
    rm -fr $extract0
    unsquashfs -f -d $extract0 $tcz_dir/ca-certificates.tcz
    msg removing unwanted certificates
    oldcerts=$extract0/usr/local/share/ca-certificates
    # For now don't delete old certs to allow testing 
    # with the digicert certificates used by Symantec
    #for d in `cd $oldcerts; find . -mindepth 1 -maxdepth 1 -type d;`; do
    #    echo $oldcerts : $d
    #    if [ "$d" != "./files" ]; then
    #    msg removing certificates from $d
    #        ( cd $oldcerts; rm -fr $d )
    #    fi
    #done
    getcrt $mscrtfiles  
    pemdest=$extract0/usr/local/share/ca-certificates/dsas
    cmd mkdir -pv $pemdest
    crt2pem $mscrtfiles
    chroot $extract0 /usr/local/sbin/update-ca-certificates
    rm -f $tcz_dir/ca-certificates.tcz
    mksquashfs $extract0 $tcz_dir/ca-certificates.tcz
}


case $1 in
-clean)
  rm -fr $extract $newiso $mnt $work/tmpcert $dsascd $dsascd.md5 $work/dsas_pass.txt
  exit 0
  ;;
-realclean)
  rm -fr $work
  exit 0
  ;;
esac

# Get the ISO
msg Downloading $livecd_url
test -f $livecd0 || cmd curl -o $livecd0 $livecd_url

# Unpack the ISO
mkdir -pv $mnt
if ! ls $squashfs >/dev/null 2> /dev/null; then
  mount | grep $livecd0 > /dev/null || cmd mount $livecd0 $mnt
  cmd rsync -av --exclude=boot.cat $mnt/* $newiso/
  cmd umount $mnt
fi

# Unpack squashfs
if ! ls $extract/proc > /dev/null 2> /dev/null; then
  cmd mkdir -p $extract
  zcat $squashfs | { cd $extract; cpio -i -H newc -d; }
fi

# Create the desired certificates
create_certs

# Install the needed packages
install_tcz openssl-1.1.1  # explicitly install openssl first so avail to ca-certificate
install_tcz curl
install_tcz kmaps
install_tcz openssh
install_tcz osslsigncode
install_tcz libxml2-bin   # For xmllint

# copy preloaded packages to work dir. This must be after packages
# are installed to allow for files to be overwritten. Run as root 
# and correct the ownership of files 
msg append dsas files
rsync -av $append/ $work/
chown -R root.root $extract/usr
chown root $extract/opt/bootlocal.sh

# prevent autologin of tc user
( cd $extract/etc; cat inittab | sed -r 's/(.*getty)(.*autologin)(.*)/\1\3/g' > inittab.new; )
( cd $extract/etc; mv inittab.new inittab; )

# Create users
passfile=$work/dsas_pass.txt
cp /dev/null $passfile
chmod 700 $passfile

create_users=$extract/tmp/create_users.sh
cp /dev/null $create_users

msg WARNING: Change default password for 'tc' user and run 'filetool.sh -b'
echo tc:dSa02021cTf >> $passfile
cat << EOF >> $create_users
echo tc:dSaO2021cTf | chpasswd
EOF

msg adding user 'verif'
pwgen $service_pass_len
echo "verif:$pass" >> $passfile
cat << EOF >> $create_users
adduser -s /bin/false -u 2000 -D -H verif
echo verif:$pass | chpasswd
EOF

msg adding user 'bas'
pwgen $service_pass_len
echo "bas:$pass" >> $passfile
cat << EOF >> $create_users
adduser -s /bin/false -u 2001 -D -H -h / bas
echo bas:$pass | chpasswd
EOF

msg adding user 'haut'
pwgen $service_pass_len
echo "haut:$pass" >> $passfile
cat << EOF >> $create_users
adduser -s /bin/false -u 2002 -D -H -h / haut
echo bas:$pass | chpasswd
EOF

cat << EOF >> $create_users
addgroup verif bas
addgroup verif haut
EOF

chmod 755 $create_users
chroot $extract /tmp/create_users.sh
rm $create_users

# customize boot screen
rsync -rv ./boot/ $newiso/boot/

tmp=$work/squashfs.gz
( cd $extract; find | cpio -o -H newc; ) | gzip -2 > $squashfs
mkisofs=$(which mkisofs genisoimage | head -n 1)
cmd $mkisofs -l -J -R -V TC-custom -no-emul-boot -boot-load-size 4 \
  -boot-info-table -b boot/isolinux/isolinux.bin \
  -c boot/isolinux/boot.cat -o $dsascd $newiso
msg creating $dsascd.md5
(cd $work; md5sum `basename $dsascd`; ) > $dsascd.md5

if [ "$1" != "-keep" ]; then
  rm -fr $extract $newiso $mnt $tmpcert
fi
