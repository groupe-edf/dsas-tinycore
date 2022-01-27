# Overide the container name like
#   make CONTAINER=haut install
#   make CONTAINER=bas install
# To have to containers on the same machine for testing

IMAGE_NAME := dsas
IMAGE_TAG := 12.0-x86_64
CONTAINER := haut
NET0 := $(shell if [ "$(CONTAINER)" = "bas" ]; then echo "192.168.0.0/24"; else echo "192.168.1.0/24"; fi)
GW0 := $(shell if [ "$(CONTAINER)" = "bas" ]; then echo "192.168.0.254"; else echo "192.168.1.254"; fi)
IP_ETH0 := $(shell if [ "$(CONTAINER)" = "bas" ]; then echo "192.168.0.1"; else echo "192.168.1.1"; fi)
ETH1 := enp0s3
NET1 := 192.168.192.0/24
GW1 := 192.168.192.254
IP_ETH1 := $(shell if [ "$(CONTAINER)" = "bas" ]; then echo "192.168.192.1"; else echo "192.168.192.2"; fi)

.PHONY: install uninstall network_phy network_virt run
	
uninstall:
	docker container ls | grep -q $(CONTAINER) && \
	  docker container stop $(CONTAINER) || true
	docker container ls -a | grep -q $(CONTAINER) && \
	  docker container rm $(CONTAINER) || true
	docker images $(IMAGE_NAME) | grep -q $(IMAGE_TAG) && docker rmi $(IMAGE_NAME):$(IMAGE_TAG) || true
	docker volume rm $(CONTAINER)_sda1 || true
	docker network rm dsas_eth1 || true
	docker network rm $(CONTAINER)_eth0 || true
	
install: remove_container build_image network_virt
	# Iface name of "doc" to get the DSAS to always recognize the main iface
	docker network ls | grep -q $(CONTAINER)_eth0 || docker network create \
	  --subnet=$(NET0) --gateway=$(GW0) \
	  --opt com.docker.network.container_iface_prefix=doc $(CONTAINER)_eth0
	docker volume ls | grep -q $(CONTAINER)_sda1 || \
	  (docker volume create $(CONTAINER)_sda1 && \
	  docker create --network=$(CONTAINER)_eth0 --ip $(IP_ETH0) --tty --interactive \
	    --cap-add=CAP_NET_ADMIN -v $(CONTAINER)_sda1:/mnt/sda1  --name $(CONTAINER) \
	    $(IMAGE_NAME):$(IMAGE_TAG) /bin/sh -c "/etc/init.d/rcS.docker --install" && \
	  docker network connect --ip $(IP_ETH1) dsas_eth1  $(CONTAINER) && \
	  docker container start --interactive $(CONTAINER) && \
	  docker container stop $(CONTAINER) && \
	  docker container rm $(CONTAINER);)
	docker create --network=$(CONTAINER)_eth0 --ip $(IP_ETH0) \
	  --cap-add=CAP_NET_ADMIN --cap-add=SYS_PTRACE --ulimit nofile=65535 \
	  -v $(CONTAINER)_sda1:/mnt/sda1  --name $(CONTAINER) \
	  $(IMAGE_NAME):$(IMAGE_TAG) /bin/sh -c "/etc/init.d/rcS.docker"
	docker network connect --ip $(IP_ETH1) dsas_eth1  $(CONTAINER)

remove_container:
	docker container ls | grep -q $(CONTAINER) && \
	  docker container stop $(CONTAINER) || true
	docker container ls -a |  grep -q $(CONTAINER) && \
	  docker container rm $(CONTAINER) || true

build_image:
	docker images | grep $(IMAGE_NAME) | grep -q $(IMAGE_TAG) || docker build \
	  -t $(IMAGE_NAME):$(IMAGE_TAG) .

network_phy:
	docker network ls | grep -q dsas_eth1 || docker network create --driver=macvlan \
	  --subnet=$(NET1) --gateway=$(GW1) -o parent=$(ETH1) dsas_eth1

network_virt:
	docker network ls | grep -q dsas_eth1 || docker network create \
	  --subnet=$(NET1) --gateway=$(GW1) dsas_eth1

start:
	docker container start $(CONTAINER)

stop:
	docker container stop $(CONTAINER)

