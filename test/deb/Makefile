ifndef BASE
BASE :=  /tmp
endif

XMLFILE := ${BASE}/dsas_conf.xml
HAUT := ${BASE}/share/tests

define newline


endef

define task
    <task>
      <name>Deb</name>
      <id>${id}</id>
      <directory>tests/Deb/dists/stable</directory>
      <uri />
      <type>deb</type>
      <archs>
        <arch>all</arch>
      </archs>
      <run>never</run>
      <ca><fingerprint /><name /></ca>
      <cert>
        <name>Deb</name>
        <fingerprint>${finger}</fingerprint>
      </cert>
    </task>
endef

define cert
    <certificate>
      <type>gpg</type>
      <name>Deb</name>
      <pem></pem>
      <authority>true</authority>
    </certificate>
endef

define control
Package: ${t}
Version: 1.0
Maintainer: deb@example.com
Depends:
Architecture: all
Homepage: http://example.com
Description: A simple deb package that does nothing
endef

Deb.pub:
	mkdir -p ${HOME}/.gnupg
	chmod go-rwx ${HOME}/.gnupg
	echo "no-allow-external-cache" > ${HOME}/.gnupg/gpg-agent.conf
	gpg --batch --gen-key gpg.batch
	rm -f Deb.pub
	gpg --output Deb.pub --armor --export deb@example.com
	grep "Passphrase:" gpg.batch | cut -d: -f2 | xargs > passphrase
	chmod go-rwx passphrase

good_1.0-1_all.deb:
	$(eval d:=good_1.0-1_all)
	mkdir -p ${d}/usr/local/share/dsas/tests
	echo "Good DSAS deb verification file" > ${d}/usr/local/share/dsas/tests/good_deb
	$(eval t:=good)
	echo -e '$(subst $(newline),\n,$(control))' > ${d}/control
	./dpkg_deb ${d}
	rm -fr ${d}

bad_1.0-1_all.deb:
	$(eval d:=bad_1.0-1_all)
	mkdir -p ${d}/usr/local/share/dsas/tests
	echo "Bad DSAS deb verification file" > ${d}/usr/local/share/dsas/tests/bad_deb
	$(eval t:=bad)
	echo -e '$(subst $(newline),\n,$(control))' > ${d}/control
	./dpkg_deb ${d}
	rm -fr ${d}

unsigned_1.0-1_all.deb:
	$(eval d:=unsigned_1.0-1_all)
	mkdir -p ${d}/usr/local/share/dsas/tests
	echo "Unsigned DSAS deb verification file" > ${d}/usr/local/share/dsas/tests/unsigned_deb
	$(eval t:=unsigned)
	echo -e '$(subst $(newline),\n,$(control))' > ${d}/control
	./dpkg_deb ${d}
	rm -fr ${d}

virus_1.0-1_all.deb:
	$(eval d:=virus_1.0-1_all)
	mkdir -p ${d}/usr/local/share/dsas/tests
	zcat ../eicar.gz > ${d}/usr/local/share/dsas/tests/virus_deb
	$(eval t:=virus)
	echo -e '$(subst $(newline),\n,$(control))' > ${d}/control
	./dpkg_deb ${d}
	rm -fr ${d}

all: Deb.pub good_1.0-1_all.deb bad_1.0-1_all.deb unsigned_1.0-1_all.deb virus_1.0-1_all.deb
	$(eval id:=$(shell < /dev/random tr -dc a-f0-9 | head -c "24"; echo;))
	$(eval finger:=$(shell gpg -v Deb.pub 2> /dev/null | head -2 | tail -1 | xargs))
	$(eval t:=$(shell echo '$(subst $(newline),\n,$(task))'))
	$(eval c:=$(shell echo '$(subst $(newline),\n,$(cert))'))
	sed -i -e 's:<tasks>:<tasks>\n    ${t}:' ${XMLFILE}
	sed -i -e 's:<certificates>:<certificates>\n    ${c}:' ${XMLFILE}
	awk -i inplace 'BEGIN { while (getline < ARGV[2]) { pemcert = pemcert $$0 "\n" } delete ARGV[2]; } \
	  { if (/<pem><\/pem>/) { print "      <pem>" pemcert "</pem>"; } else { print $$0; }}' ${XMLFILE} Deb.pub
	mkdir -p ${HAUT}/Deb/pool/main
	cp -f good_1.0-1_all.deb bad_1.0-1_all.deb virus_1.0-1_all.deb ${HAUT}/Deb/pool/main
	echo "Bad" >> ${HAUT}/Deb/pool/main/bad_1.0-1_all.deb
	mkdir -p ${HAUT}/Deb/dists/stable/main/binary-all
	./dpkg_scanpackages ${HAUT}/Deb/pool > ${HAUT}/Deb/dists/stable/main/binary-all/Packages
	cp -f unsigned_1.0-1_all.deb bad_1.0-1_all.deb ${HAUT}/Deb/pool/main
	gzip -k ${HAUT}/Deb/dists/stable/main/binary-all/Packages
	./dpkg_release ${HAUT}/Deb/dists/stable  > ${HAUT}/Deb/dists/stable/Release
	gpg --pinentry-mode loopback --passphrase-file=passphrase --local-user deb@example.com --output ${HAUT}/Deb/dists/stable/Release.gpg -a --detach-sig ${HAUT}/Deb/dists/stable/Release
	gpg --pinentry-mode loopback --passphrase-file=passphrase --local-user deb@example.com --output ${HAUT}/Deb/dists/stable/InRelease --clearsign ${HAUT}/Deb/dists/stable/Release

clean:
	rm -fr Deb.pub good_1.0-1_all.deb good_1.0-1_all bad_1.0-1_all.deb bad_1.0-1_all passphrase
	rm -fr unsigned_1.0-1_all.deb unsigned_1.0-1_all virus_1.0-1_all.deb virus_1.0-1_all
