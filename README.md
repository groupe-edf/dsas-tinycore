# DSAS - Sas de décontamination

Tous les outils nécessaire a créer des ISO de la DSAS sont basé sur TinyCore
Linux. L'iso de CorePlus peut être utilisé pour la build, mais apriori n'importe
laquel souche linux pourrait être utilisé. Personellement je fais des builds en
32bit car TinyCore est plus complet en 32bit, mais des builds en 64bit devrait être
possible

## Outils nécessaire

Vous avez besoins les outils ci-joint

* Un souche linux (32bit de préférence) avec un accès root en sudo
* make, gcc et l'ensemble des outils du souche de compilation
* rsync
* genisoimage ou mkisofs
* squashfs-tools
* curl

Si le machine de build est un TinyCore CorePlus, les commandes a faire sont

```
tce-load -wi compiletc
tce-load -wi rsync
tce-load -wi coreutils
tce-load -wi mkisofs-tools
tce-load -wi squashfs-tools
tce-load -wi git
tce-load -wi rsync
tce-load -wi curl
tce-load -wi ncursesw-dev

```

## Le process de build

Premierement est-ce que vous êtes derriere un proxy HTTP ? Par exemple sur
la RIN a EDF il faut utilisre la faire

```
export http_proxy=http://vip-users.proxy.edf.fr:3131
export https_proxy=http://vip-users.proxy.edf.fr:3131
```

afin de permettre la build a avoir un accès à l'internet. Après le build est
fait avec le commande

```
./make.sh
```

Nous pourrait garder les fichiers temporaires avec option "-keep" et faire
la build d'un package (voir pkg/*.pkg) à partir des sources avec

```
./make.sh build gnupg
```

La compilation d'un version 32-bit du DSAS est possible depuis une souch 64-bit
avec une commande comme

```
./make.sh -32
``` 

## Nettoyage de la build

Afin de néttoyer les fichiers utilisé pendant le build vous pouvez faire

```
./make.sh clean
```

Les ISOs du DSAS sont gardés, mais l'ensemble des fichiers intermediaire 
sont détruit. Afin de completement nettoyer le build utiliser le commande

```
./make.sh realclean
```
