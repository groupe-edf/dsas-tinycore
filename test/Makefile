ifndef SRC
SRC := ../work/src
endif

ifndef PKG
PKG := ../pkg
endif

ifndef TCZ
TCZ := ../work/tcz
endif

SUBDIRS := cyberwatch openssl gpg
BASE := $(shell pwd)/work
VERSION := 0.1

pkg:
	sed -e "s/<VERSION>/$(VERSION)/g" dsastestfiles.pkg > $(PKG)/dsastestfiles.pkg
	cp ../append/var/dsas/dsas_conf.xml dsas_conf.xml
	sed -i -e "s,<first>true</first>,," dsas_conf.xml
	tar --transform 's,^,dsastestfiles-$(VERSION)/,' -cvzf $(SRC)/dsastestfiles-$(VERSION).tgz  Makefile dsas_conf.xml tests.php runtests $(SUBDIRS)
	rm -f dsas_conf.xml

all : setup $(SUBDIRS)
	chmod -R o-rwx $(BASE)/share
	find $(BASE)/share -mindepth 1 -type d -exec chmod 770 {} \;
	cd $(BASE)/share; tar --owner haut --group haut -cvzf ../../tests.tgz . 

install:
	mkdir -p $(DEST)/home/tc
	cp tests.tgz tests.php runtests $(BASE)/dsas_conf.xml $(DEST)/home/tc
	chown -R tc.staff $(DEST)/home/tc
	chmod -R 750 $(DEST)/home/tc
	mkdir -p $(DEST)/var/dsas
	cp $(BASE)/dsas_conf.xml $(DEST)/var/dsas
	chown tc.staff $(DEST)/var/dsas/dsas_conf.xml 

setup :
	mkdir -p $(BASE)
	cp dsas_conf.xml  $(BASE)

clean : $(SUBDIRS)
	rm -fr $(BASE) dsas_conf.xml tests.zip 
	rm -f $(SRC)/dsastestfiles_$(VERSION).tgz $(PKG)/dsastestfiles.pkg
	rm -f $(TCZ)*/dsastestfiles.tcz

$(SUBDIRS):
	make -C $@ BASE=$(BASE) $(MAKECMDGOALS)

.PHONY: all $(SUBDIRS)
