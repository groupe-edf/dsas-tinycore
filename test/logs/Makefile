ifndef BASE
BASE :=  /tmp
endif

all: dsas_verif.log.0
	mkdir -p ${BASE}/log
	cp -f dsas_verif.log dsas_verif.log.0 ${BASE}/log

dsas_verif.log.0:
	cp -f dsas_verif.log dsas_verif.log.0
	echo "**  Bad Sig         deadbeefdeadbeefdeadbeefdeadbeef 20220701100046 tests/Dummy/dummy-search" >> dsas_verif.log.0

clean:
	rm -f dsas_verif.log.0 
