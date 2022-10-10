# DSAS - Decontaminating file transfers
[en](#) [fr](README-fr.md)

The isolation of industrial infrastructures is essential to limit
the possibility of malicious attack. However, this isolation limits the
ability to automate the downloading of software updates (operating systems,
viral signatures, other updates) that are essentiel to the health of all
sensitive systems. Configuration and other files are also difficult to
send to sensitive systems.

The objective of the "Decontaminating Security Access Service" DSAS is to download
security updates, to control their integrity and to make them available to the
sensitive systems. The DSAS will also allow the use of USB keys to be eliminated
on our industrial infrastructures, and therefore the DSAS includes the ability
to transfer files signed by authorized people. Finally, the DSAS ensures a 
protocol break between the various security zones in a defense in depth strategy.

The DSAS comes with a __[complete documentation](append/usr/local/share/www/Doucmentation_en.md)__ 

# Quick Start

The DSAS is based on [TinyCore Linux](http://tinycorelinux.net). So one means to build
the DSAS is to use TinyCore, for example using the ISO of CorePlus. Otherwise any recent
linux machine can be used (debian BullsEye for example) for the build.

Both 32 and 64bit builds are possible, and a build of a 32-bit DSAS on a 64-bit machine
is possible. A 64-bit build machine is needed to perform the static code analysis.

## Tools needed

You need the following tools to build the DSAS 

* A x86 ou AMD64 linux machine with root access via sudo
* make, gcc  and all the other classic build tools 
* rsync
* genisoimage or mkisofs
* squashfs-tools
* curl

If the build machine is [TinyCore CorePlus](http://tinycorelinux.net/downloads.html),
the command to install these packages is

```shell
tce-load -wi Xorg-7.7 compiletc rsync coreutils mkisofs-tools squashfs-tools git curl ncursesw-dev tar
```

Or with debian

```shell
apt-get install build-essential rsync genisoimage squashfs-tools git curl
``` 

## The build process

To be able do build, the DSAS needs a root access via sudo. The reason is that the
build makes extensive use of the chroot command to create clean build environments for
each package. The build script also needs access to the internet to be able to download
packages. If you are behind a proxy, you'll need to configure the proxy beofr continuing

After the build command is

```
./make.sh
```

You can keep all of the temporary files of the build with the "-keep" option. The first
build will take several hours because node and clamav are rebuilt from source. To build a
package for its source (for example see [the gpg source package](pkg/gnupg.pkg)) from
the source with the command

```
./make.sh build gnupg
```

The build of a 32-bit version of the DSAS on a 64-bit is possible with the command

```
./make.sh -32
``` 

The ISO of the DSAS is then in the file `work/dsas.iso`.

## Cleaning the build

To clean all of the temporary files created during the build, the command is

```
./make.sh clean
```

This keeps the ISO, built packages and the downloaded files, but the intermediate 
files are deleted. To completely clean the build tree the command is


```
./make.sh realclean
```