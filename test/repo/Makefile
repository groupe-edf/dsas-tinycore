ifndef BASE
BASE :=  /tmp
endif

XMLFILE := ${BASE}/dsas_conf.xml
HAUT := ${BASE}/share/tests

define newline


endef

define task1
    <task>
      <name>Repomd</name>
      <id>${id}</id>
      <directory>tests/Repomd</directory>
      <uri />
      <type>repomd</type>
      <run>never</run>
      <ca><fingerprint /><name /></ca>
      <cert>
        <name>Repo</name>
        <fingerprint>${finger}</fingerprint>
      </cert>
    </task>
endef

define task2
    <task>
      <name>Rpm</name>
      <id>${id}</id>
      <directory>tests/Rpm</directory>
      <uri />
      <type>rpm</type>
      <run>never</run>
      <ca><fingerprint /><name /></ca>
      <cert>
        <name>Repo</name>
        <fingerprint>${finger}</fingerprint>
      </cert>
    </task>
endef

define cert
    <certificate>
      <type>gpg</type>
      <name>Repo</name>
      <pem></pem>
      <authority>true</authority>
    </certificate>
endef	

all: setup Repo.pub good-1-1.noarch.rpm unsigned-1-1.noarch.rpm bad-1-1.noarch.rpm virus-1-1.noarch.rpm install

setup:
	cp -f rpmmacros /home/tc/.rpmmacros
	mkdir -p /home/tc/build/rpm/BUILD /home/tc/build/rpm/RPMS/noarch /home/tc/build/rpm/SOURCES 
	mkdir -p /home/tc/build/rpm/SPECS /home/tc/build/rpm/SRPMS /home/tc/build/rpm/tmp

Repo.pub Bad.pub: setup
	mkdir -p ${HOME}/.gnupg
	chmod go-rwx ${HOME}/.gnupg
	echo "no-allow-external-cache" >> ${HOME}/.gnupg/gpg-agent.conf
	gpg --batch --gen-key gpg.batch
	rm -f Repo.pub
	gpg --output Repo.pub --armor --export repo@example.com
	gpg --output Bad.pub --armor --export bad@example.com
	grep "Passphrase:" gpg.batch | cut -d: -f2 | xargs > passphrase
	chmod go-rwx passphrase
	echo "no-allow-external-cache" >> ${HOME}/.gnupg/gpg-agent.conf
	rpm --import Repo.pub
	rpm --import Bad.pub

good-1.1.noarch.rpm: Repo.pub
	cp -f template.spec good.spec
	sed -i -e "s/#template#/good/g" good.spec
	rpmbuild -ba good.spec
	cp -f /home/rpm/build/rpm/RPMS/noarch/good-1-1.noarch.rpm good-1.1.noarch.rpm
	rpm --addsign good-1.1.noarch.rpm
	
unsigned-1.1.noarch.rpm: Repo.pub
	cp -f template.spec unsigned.spec
	sed -i -e "s/#template#/unsigned/g" unsigned.spec
	rpmbuild -ba unsigned.spec
	cp -f /home/rpm/build/rpm/RPMS/noarch/unsigned-1-1.noarch.rpm unsigned-1.1.noarch.rpm

virus-1.1.noarch.rpm: Repo.pub
	rpmbuild -ba virus.spec
	cp -f /home/rpm/build/rpm/RPMS/noarch/virus-1-1.noarch.rpm virus-1.1.noarch.rpm
	rpm --addsign virus-1.1.noarch.rpm

bad-1.1.noarch.rpm: Bad.pub
	cp -f template.spec bad.spec
	sed -i -e "s/#template#/bad/g" bad.spec
	rpmbuild -ba bad.spec
	cp -f /home/rpm/build/rpm/RPMS/noarch/bad-1-1.noarch.rpm bad-1.1.noarch.rpm
	rpm --addsign bad-1.1.noarch.rpm

install: Repo.pub
	$(eval id:=$(shell < /dev/random tr -dc a-f0-9 | head -c "24"; echo;))	
	$(eval finger:=$(shell gpg -v Repo.pub 2> /dev/null | head -2 | tail -1 | xargs))
	$(eval t1:=$(shell echo '$(subst $(newline),\n,$(task1))'))
	$(eval t2:=$(shell echo '$(subst $(newline),\n,$(task2))'))
	$(eval c:=$(shell echo '$(subst $(newline),\n,$(cert))'))
	sed -i -e 's:<tasks>:<tasks>\n    ${t1}\n    ${t2}:' ${XMLFILE}
	sed -i -e 's:<certificates>:<certificates>\n    ${c}:' ${XMLFILE}
	awk -i inplace 'BEGIN { while (getline < ARGV[2]) { pemcert = pemcert $$0 "\n" } delete ARGV[2]; } \
	  { if (/<pem><\/pem>/) { print "      <pem>" pemcert "</pem>"; } else { print $$0; }}' ${XMLFILE} Gpg.pub
	mkdir -p ${HAUT}/Repomd/Packages  ${HAUT}/Repomd/repodata
	cp -f good-1-1.noarch.rpm unsigned-1-1.noarch.rpm bad-1-1.noarch.rpm unsigned-1-1.noarch.rpm ${HAUT/Repomd/Packages

clean:
	rm -f Repo.pub Bad.pub good-1.1.noarch.rpm unsigned-1.1.noarch.rpm bad-1-1.noarch.rpm
	rm -f virus-1.1.noarch.rpm good.spec bad.spec unsigned.spec
	rm -fr /home/tc/build/rpm