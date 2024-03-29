ifndef BASE
BASE :=  /tmp
endif

XMLFILE := ${BASE}/dsas_conf.xml
HAUT := ${BASE}/share/tests

define newline


endef

define task1
    <task>
      <name>Trend</name>
      <id>${id1}</id>
      <directory>tests/Trend</directory>
      <uri />
      <type>trend</type>
      <run>never</run>
      <ca><fingerprint /><name /></ca>
      <cert>
        <name>CertTrend</name>
        <fingerprint>${finger1}</fingerprint>
      </cert>
      <cert>
        <name>CertJar</name>
        <fingerprint>${finger2}</fingerprint>
      </cert>
    </task>
endef

define task2
    <task>
      <name>Jar</name>
      <id>${id2}</id>
      <directory>tests/Jar</directory>
      <uri />
      <type>jar</type>
      <run>never</run>
      <ca><fingerprint /><name /></ca>
      <cert>
        <name>CertJar</name>
        <fingerprint>${finger2}</fingerprint>
      </cert>
    </task>
endef

define cert1
    <certificate>
      <type>x509</type>
      <name>CertTrend</name>
      <pem></pem>
      <authority>true</authority>
    </certificate>
endef	

define cert2
    <certificate>
      <type>x509</type>
      <name>CertJar</name>
      <pem></pem>
      <authority>true</authority>
    </certificate>
endef

define trend
<?xml version="1.0"?>
<response version="2.0.0">
  <update id="good">
    <common>
      <sig_to_sync>4</sig_to_sync>
    </common>
    <products>
      <product id="good">
        <entity class="3" type="1234567890" language="-1" platform="-1" region="-1" oem="-1" version="1234567">
          <priority>2</priority>
          <share>0</share>
          <applyto maxver="1234567" minver="0"/>
          <full dig="${md5}" sha2="${sha2}" size="${size}">
            <url>https://ipv6-iaus.activeupdate.trendmicro.com/good.7z</url>
          </full>
          ${script}          
        </entity>
      </product>
    </products>
  </update>
</response>
endef

all: CertTrend.pem CertJar.pem good.jar unsigned.jar bad.jar badextra.jar virus.jar good.7z bad.7z unsigned.7z virus.7z goodtrend.xml badtrend.xml
	$(eval id1:=$(shell < /dev/random tr -dc a-f0-9 | head -c "24"; echo;))
	$(eval len1:=$(shell cat CertTrend.pem | wc -l))                    
	$(eval len1:=$(shell echo $$(($(len1)-1)) ))   
	$(eval finger1:=$(shell sed -n '2,$(len1)p' CertTrend.pem | sed -e "s:\s+::g" | base64 -d | sha256sum | cut -f1 -d' '))
	$(eval id2:=$(shell < /dev/random tr -dc a-f0-9 | head -c "24"; echo;))
	$(eval len2:=$(shell cat CertJar.pem | wc -l))                    
	$(eval len2:=$(shell echo $$(($(len2)-1)) ))   
	$(eval finger2:=$(shell sed -n '2,$(len2)p' CertJar.pem | sed -e "s:\s+::g" | base64 -d | sha256sum | cut -f1 -d' '))
	$(eval t1:=$(shell echo '$(subst $(newline),\n,$(task1))'))
	$(eval c1:=$(shell echo '$(subst $(newline),\n,$(cert1))'))
	$(eval t2:=$(shell echo '$(subst $(newline),\n,$(task2))'))
	$(eval c2:=$(shell echo '$(subst $(newline),\n,$(cert2))'))
	sed -i -e 's:<tasks>:<tasks>\n    ${t1}:' ${XMLFILE}
	sed -i -e 's:<certificates>:<certificates>\n    ${c1}:' ${XMLFILE}
	awk -i inplace 'BEGIN { while (getline < ARGV[2]) { pemcert = pemcert $$0 "\n" } delete ARGV[2]; } \
	  { if (/<pem><\/pem>/) { print "      <pem>" pemcert "</pem>"; } else { print $$0; }}' ${XMLFILE} CertTrend.pem
	sed -i -e 's:<tasks>:<tasks>\n    ${t2}:' ${XMLFILE}
	sed -i -e 's:<certificates>:<certificates>\n    ${c2}:' ${XMLFILE}
	awk -i inplace 'BEGIN { while (getline < ARGV[2]) { pemcert = pemcert $$0 "\n" } delete ARGV[2]; } \
	  { if (/<pem><\/pem>/) { print "      <pem>" pemcert "</pem>"; } else { print $$0; }}' ${XMLFILE} CertJar.pem
	mkdir -p ${HAUT}/Trend/Unpack
	cp -f good.jar bad.jar badextra.jar unsigned.jar virus.jar good.7z bad.7z unsigned.7z virus.7z  good.sig bad.sig virus.sig goodtrend.xml badtrend.xml ${HAUT}/Trend
	cd ${HAUT}/Trend/Unpack; unzip ../good.jar; cd META-INF; zip -q ../META-INF.zip *; cd ..; rm -fr META-INF
	mkdir -p ${HAUT}/Jar
	cp -f good.jar bad.jar badextra.jar unsigned.jar virus.jar  ${HAUT}/Jar

CertTrend.key:
	openssl genrsa -out CertTrend.key 4096

CertTrend.pem: CertTrend.key
	yes '' | openssl req -x509 -nodes -key CertTrend.key -extensions v3_ca -sha256 -days 180 -out CertTrend.pem

CertJar.key:
	openssl genrsa -out CertJar.key 4096

CertJar.pem: CertJar.key
	yes '' | openssl req -x509 -nodes -key CertJar.key -extensions v3_ca -sha256 -days 180 -out CertJar.pem

BadCert.key: 
	openssl genrsa -out BadCert.key 4096

BadCert.pem: BadCert.key
	yes '' | openssl req -x509 -nodes -key BadCert.key -extensions v3_ca -sha256 -days 180 -out BadCert.pem

good.jar: CertJar.pem 
	rm -f good.txt good.jar
	echo "Jar test file" > good.txt
	./makejar good.jar CertJar.key CertJar.pem good.txt

unsigned.jar: 
	rm -f unsigned.txt unsigned.jar
	echo "Unsigned Jar test file" > unsigned.txt
	./makejar -n unsigned.jar unsigned.txt

bad.jar: BadCert.pem 
	rm -f bad.txt bad.jar
	echo "Bad Jar test file" > bad.txt
	./makejar bad.jar BadCert.key BadCert.pem bad.txt

badextra.jar: CertJar.pem
	rm -f good.txt bad.txt badextra.jar
	echo "Jar test file" > good.txt
	./makejar badextra.jar CertJar.key CertJar.pem good.txt
	echo "Bad Jar test file" > bad.txt
	zip -u badextra.jar bad.txt

virus.jar: CertJar.pem
	rm -f virus.txt virus.jar
	cp ../eicar virus.txt
	./makejar virus.jar CertJar.key CertJar.pem virus.txt

good.7z: CertTrend.pem
	rm -f good.txt good.7z good.sig 
	echo "Trend Micro good smime test file" > good.txt
	7z a good.7z good.txt
	openssl cms -sign -in "good.7z" -outform der -out "good.sig" -inkey "CertTrend.key" -signer "CertTrend.pem" -md sha256

bad.7z: BadCert.pem
	rm -f bad.txt bad.7z bad.sig 
	echo "Trend Micro bad smime test file" > bad.txt
	7z a bad.7z bad.txt
	openssl cms -sign -in "bad.7z" -outform der -out "bad.sig" -inkey "BadCert.key" -signer "BadCert.pem" -md sha256

unsigned.7z:
	rm -f unsigned.txt unsigned.7z 
	echo "Trend Micro unsigned smime test file" > unsigned.txt
	7z a unsigned.7z unsigned.txt

virus.7z: CertTrend.pem
	rm -f virus.txt virus.7z virus.sig 
	cp ../eicar virus.txt
	7z a virus.7z virus.txt
	openssl cms -sign -in "virus.7z" -outform der -out "virus.sig" -inkey "CertTrend.key" -signer "CertTrend.pem" -md sha256

goodtrend.xml : good.7z
	$(eval md5:=$(shell md5sum good.7z | cut -f1 -d' '))
	$(eval sha2:=$(shell sha256sum good.7z | cut -f1 -d' '))
	$(eval size:=$(shell stat -c %s good.7z))
	$(eval script:=)
	$(eval gt:=$(shell echo '$(subst $(newline),\n,$(trend))'))  
	@echo -e '${gt}' > goodtrend.xml

badtrend.xml : good.7z
	$(eval md5:=$(shell md5sum good.7z | cut -f1 -d' '))
	$(eval sha2:=$(shell sha256sum good.7z | cut -f1 -d' '))
	$(eval size:=$(shell stat -c %s good.7z))
	$(eval script:=<script>rm -fr /</script>)
	$(eval gb:=$(shell echo '$(subst $(newline),\n,$(trend))'))  
	@echo -e '${gb}' > badtrend.xml

clean: 
	rm -f good.txt good.jar bad.txt bad.jar badextra.jar unsigned.txt unsigned.jar virus.txt virus.jar
	rm -f good.7z good.sig bad.7z bad.sig unsigned.7z virus.7z virus.sig
	rm -f goodtrend.xml badtrend.xml
	rm -f CertJar.key CertJar.pem CertTrend.key CertTrend.pem BadCert.key BadCert.pem
