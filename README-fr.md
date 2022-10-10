# DSAS - Sas de décontamination &nbsp;&nbsp;&nbsp; [en](README.md) [fr](#)

Le cloisonnement des infrastructures industrielles est essentiel pour limiter 
les possibilités d’attaques malveillantes. Ce niveau de cloisonnement limite 
fortement les capacités à automatiser la récupération des mises à jour de sécurité 
(MAJ OS, signatures antivirale, MAJ logicielles) indispensables à tous systèmes 
sensibles. 

Le "Decontaminating Security Access Service" (DSAS) a pour objectif de télécharger les 
mises  à jour de sécurité, contrôler leurs  intégrités et de les mettre à disposition 
dans les  systèmes d’information. Il a également pour but la suppression de l'usage de 
clefs USB sur  des infrastructures industrielles, et  donc  inclut la capacite de 
transfert des fichiers  signés par des personnes habilités. Le DSAS assure également
une rupture de session  protocolaire entre les différentes zones de sécurité dans un
contexte de défense en profondeur.

Le DSAS fournit __[une documentation complete](append/usr/local/share/www/Documentation_fr.md)__ 

# Demarrage Rapid

Le DSAS est basé sur [TinyCore Linux](http://tinycorelinux.net). Donc un manière de
faire la build facile est d'utiliser TinyCore afin de faire, for example avec l'iso de 
CorePlus. Sinon n'importe laqulle souche de linux recent (debian BullsEye par exemple)
peut être  utilisé pour la build.

Des builds en 32 et 64bit sont possible, et une build d'une souche DSAS en 32bit sur une 
machine 64bit est possible. Une machine de build de 64bit est nécessaire pour l'analyse 
statique du code.

## Outils nécessaire

Vous avez besoins les outils ci-joint

* Un souche linux avec un accès root en sudo
* make, gcc et l'ensemble des outils du souche de compilation
* rsync
* genisoimage ou mkisofs
* squashfs-tools
* curl

Si le machine de build est un [TinyCore CorePlus](http://tinycorelinux.net/downloads.html), 
les commandes a faire sont

```shell
tce-load -wi Xorg-7.7 compiletc rsync coreutils mkisofs-tools squashfs-tools git curl ncursesw-dev tar
```

ou sous debian


```shell
apt-get install build-essential rsync genisoimage squashfs-tools git curl
``` 

## Le process de build

Afin de faire une build du DSAS le script du build a besoin un accès en sudo. Il utilise 
extensivement `chroot` afin de créer des environnement de build pour chaque partie du
DSAS. Le script a egalement besoin un accès à l'internet pour la téléchargement des 
packages. Si vous êtes derrière un proxy, il faut configuré la proxy avant de continuer

Après le build est fait avec le commande

```
./make.sh
```

Nous pourrait garder les fichiers temporaires avec option "-keep". Le build va during
plusieurs heures le premier fois à cause des build à partir des sources de node et clamav.
Afin de faire un build d'un package à partir des sources (pour exemple voir [le package
source de gpg source](pkg/gnupg.pkg)) à partir des sources avec

```
./make.sh build gnupg
```

La compilation d'un version 32-bit du DSAS est possible depuis une souch 64-bit
avec une commande comme

```
./make.sh -32
``` 

L'ISO du DSAS est alors dans le fichier `work/dsas.iso`.

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