ifndef SRC
SRC := ../work/src
endif

ifndef PKG
PKG := ../pkg
endif

ifndef TCZ
TCZ := ../work/tcz
endif

SUBDIRS := deb repo cyberwatch openssl gpg authenticode liveupdate certificates logs
BASE := $(shell pwd)/work
VERSION := 0.1

pkg:
	sed -e "s/<VERSION>/$(VERSION)/g" dsastestfiles.pkg > $(PKG)/dsastestfiles.pkg
	cp ../append/var/dsas/dsas_conf.xml dsas_conf.xml
	sed -i -e "s,<first>true</first>,," dsas_conf.xml
	sed -i -e '/<antivirus>/{$!{N;s,\(<antivirus>.*\n.*<active>\)false,\1true,;ty;P;D;:y}}' dsas_conf.xml
	tar --transform 's,^,dsastestfiles-$(VERSION)/,' -cvzf $(SRC)/dsastestfiles-$(VERSION).tgz  Makefile eicar.* dsas_conf.xml dsastests $(SUBDIRS)
	rm -f dsas_conf.xml

all : setup $(SUBDIRS)
	chmod -R o-rwx $(BASE)/share
	find $(BASE)/share -mindepth 1 -type d -exec chmod 770 {} \;
	cd $(BASE)/share; tar --owner haut --group haut -cvzf ../../tests.tgz . 

install:
	mkdir -p $(DEST)/usr/local/sbin
	cp dsastests $(DEST)/usr/local/sbin
	chmod a+x $(DEST)/usr/local/sbin/dsastests
	mkdir -p $(DEST)/usr/local/share/dsas
	cp eicar.ndb tests.tgz $(BASE)/dsas_conf.xml $(DEST)/usr/local/share/dsas
	mkdir -p $(DEST)/var/dsas
	cp $(BASE)/dsas_conf.xml $(DEST)/var/dsas
	cp -r $(BASE)/log $(DEST)/usr/local/share/dsas/log
	cp -r $(BASE)/Certificates $(DEST)/usr/local/share/dsas/Certificates
	chown tc.staff $(DEST)/var/dsas/dsas_conf.xml 

setup :
	mkdir -p $(BASE)/share
	cp dsas_conf.xml  $(BASE)
	rm -f eicar
	gunzip -k eicar.gz

clean : $(SUBDIRS)
	rm -fr $(BASE) dsas_conf.xml tests.zip eicar
	rm -f $(SRC)/dsastestfiles_$(VERSION).tgz $(PKG)/dsastestfiles.pkg
	rm -f $(TCZ)*/dsastestfiles.tcz

$(SUBDIRS):
	make -C $@ BASE=$(BASE) $(MAKECMDGOALS)

.PHONY: all $(SUBDIRS)
