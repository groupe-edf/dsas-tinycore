# Introduction

Le cloisonnement des infrastructures industrielle est essentiel pour limiter 
les possibilités d’attaques malveillantes. Ce niveau de cloisonnement limite 
fortement les capacités à automatiser la récupération des mises à jours de sécurité 
(MAJ OS, signatures SEP, MAJ logiciels) indispensables à tous systèmes sensibles. 
Les fichiers de configuration et d'autre support venant d'ailleurs sont egalement
difficle à recuperer.

Généralement des clés usb sont utilisées pour injecter des fichiers dans les 
systèmes d’information.  Ce mode de transfère nécessite des interventions humaines 
(chronophage) et expose le système industriel à une contamination virale à chaque 
branchement. Des moins organisationnelle pourait être mise en place afin de controller
les clefs USB a chaque utilisation, mais la risque de contamination est impossible
à exclure.

Donc nous avons besoin un moyen technique de transfer des fichiers d'un zone non
sensible vers nos infrastructure industriel, et de controler symetatiquement tout
transfert afin de exclure les risques de malveillance. Le XXXXXXXXX (DSAS) a but
de mettre en place ce moyen de transfert sécurisé. Le DSAS a pour objectif de 
télécharger les mises à jours de sécurité, contrôler leurs intégrités et de les 
mettre à disposition dans les systèmes d’information. Il a également pour la 
suppression des usages des clef USB sont des infrastructure industriel.

Le DSAS assure égalemenr une rupture de session protoclaire entre les différentes
zone de sécurité dans un contexte de défense en profondeur.

## Architecture

Les principes du DSAS sont les suivante

- Le DSAS n'est pas integré dans aucun des deux domaines interconnecté, mais 
cloissonné des deux. Les connexions vers les DSAS doit être strictement 
controllés. 
- Aucun service ou port réseau non utilisé doit être dispsonible. Les logiciels
non  utilisé doit être désinstallé
- Le DSAS doit implementé un rupture complet entre les deux domaines de sensiblité.
Ceci est implementé par l'utilisation de deux machine distinct pour les connexions
vers les deux zones de sécurité differents, afin qu'une compromission de la machine 
interconnecté avec le zone non sensible mettra pas a risque le zone sensible
- Aucun fichier non controlé doit être visible dans le zone sensible. Les systemes
fichiers des deux machines du DSAS doit être distinct.
- Des vérifications doit être fait par le DSAS avant de rendre disponible les
fichiers dans le zone sensible. C'est vérfications sont actuellement limité à
des controles d'intégrités mais pourait dans la futur inclure des controles des
menaces avec un moteur d'AV
- Le maintient en condition de sécurité  doit être assurer. Ceci veut dire que
l'ensemble des logiciels exposé à l'attaque doit connu, veille de sécurité mise
en place et des moyens de palier les vulnérabilité maitrisé

Ces contraints nous poussent vers un des principe d'architecture avec

- Separation de la traitement des zones sensible et non sensible sur deux machines
distinct.
- Utilisation d'un souche linux minimale avec le moins de logiciels installé possible.
Le choix d'utilisation de [Tiny Core Linux](http://tinycorelinux.net/) a été fait car 
ce souche est mise à jour régulairement et l'installation minimale (de 12 megactets) 
n'inclut que le noyau de linux, busybox et quelques script de démarrage. Aucun service
est démarré par défaut
- Des dépendances supplementaires sont éviter; par exemple perl, python, etc ne sont pas
installé et tout script utilisé par le DSAS est écrit en shell.
- Chaque machine utilisé dans le DSAS possede deux interface réseau distinct, un pour 
la connexion vers les zone sensible et non sensible et l'autre pour l'interconnexion
entre eux.
- La sens d'initiation des flux réseau est toujours du plus senible vers le moins
sensible, et aucun port réseau sur l'interface plus sensible est exposé vers la machine 
moins sensible
- L'ensemble de l'adminsitration doit se faire via la machine en zone sensible, afin de
ne pas exposé l'administration de la machine exposé en zone non sensible.

L'architecture du DSAS simplifier est alors

![DSAS architecture](images/DSAS.png)

ou les fleches representent des flux réeau ou applicatif et les direction de ces fleches
est la sens de l'initation de ces flux

# Installation

Avec le DSAS séparé en deux machine, deux installation séparé sont nécessaire. Les deux
installation suivent le même logique. Dans la discussion suivant la machine connecté au
réseau non sensible est appelé la machine "haut" et la machine connecté au réseau sensible
est appelé la machine "bas". Un configuration initial de chaque machine est nécessaire
depuis sa console, mais après cette phase initale, tout la configuration est fait depuis
la machine bas.

Afin que la configuration se passe facilement il faut démarrer avec la configuration de
la machine haut, car même en phase initial la machine bas doit prendre la main sur la
machine haut, et il doit être configuré en premier afin d'être pret à accepter des ordres.

Dans les sections suivant si ce n'est pas dit explicitement la configuration concerne les
deux machines

## Choix des tailles des disques

Le DSAS a besoin deux disque independant, un pour chacun des deux machines utilisés 
dans son implementation. Donc le DSAS a besoin deux fois plus de disques que la 
maximum utilisé pour les transfert. Le DSAS est configuré afin de faire des "mirroir" 
des disques à télécharger, et les anciens fichiers sont supprimer site ils ne sont 
plus disponible sur leur site de téléchargement. Donc seulement l'addition des espaces
utilisé par les sites externe est nécessaire plus un peu de marge

Les mise à mise de windows des "patch tuesday" sont souvent iun 100 de megaoctets en
taille, donc multiple ca par le nombre à garder à plusiers gigaoctets pourrait être 
nécessaire pour les mise à jour de windows. Pour les mise à jour de Symantec le besoin
est dans la 150 megactets

Chaque repositoire de Linux pourrait avoir jusqu'au 50 gigaoctets utilisé, donc si on
tranfert des mise à jour de linux notre besoin de disque peut vite explosé. Dans Les
configurations suivant, nous avons utilisé un taille de 50 gigaoctets, mais nous
recommandons au moins 500 Go pour chaque machine du DSAS.

## Configuration en machine virtuel

Le DSAS est founir en forme de ISO à utiliser en "live CD". Ceci veut dire que le 
système exploitation doit démarrer toujours sur ce disque ISO. La grand advantage de
ca est que les mise à jour du DSAS va être très simple en exploitation et se resume
par l'arret du DSAS, la remplacement du ISO et la redemarrage.

L'iso du DSAS est un souche linux en 32 bit, et la virtuel machine est à configuré
en consequence. Par exemple sous VirtualBox la configuration initial devrait être

![Création VM sous VirtualBox](images/vbox1.png)

Avec la configuration de la disque comme

![Configuration disque sous VirtualBox](images/vbox2.png)

Après il faut configuré le disque de démarrage du DSAS en mettant le disaus ISO du
DSAS en maitre primaire IDE

![Boot sur ISO sous VirtualBox](images/vbox3.png)

### Interconnexion réseaux entre les machines du DSAS

Les machine virtuel sont à configurer avec deux carte reseaux. Le premier carte 
réseau est toujour utilisé pour les connexions vers les réseaux externe du DSAS
et leur configuration dependant de l'environement ou est installé le DSAS. 

Le deuxieme carte réseau est toujours utilisé pour l'interconnexion entre les 
deux machines du DSAS, et ce réseau est un réseau static en "192.168.192.0/24".
Plusieurs moins pourrait être mise en place pour la confiuration du reseau
d'interconnexion, notamment si un pare-feux supplementaire est à place sur ce
lien (pas vraiment utile). Nous conseillons l'usage un réseau interne à l'hyperviseur
configuré en VirualBox comme

![Configuration réseau d'interconnexion sous VirtualBox](images/vbox4.png)

Nous sommes maintenant prêt a démarrer la machine pour la premiere fois

## Formatage des disques

FIXME : Remove Cancel buttons in DSAS boot dialogs and change the images here !!
FIXME : Therefore don't discuss the cancel button in this documentation

A la premiere démarrage le DSAS nous demande de formatter sa disque. Un menu est
présenter avec l'ensemble des disques trouver connecté au DSAS. Ceci se presente
comme

![Formattage des disques DSAS](images/init1.png)

La navigation dans ce type de menu est fait avec les clefs suivantes

- les fleches - déplacement du cursors
- Espace - selection d'un option
- Tab - bascule entre "Ok" et "Cancel".  
- Entrée - Continuer

Utiliser "Espace" afin de selectionner la disque, ici "/dev/sda", et "Entrée" 
afin de démarrer la formattage de la disque. Après la formattage, la machine 
rédemarra automatiquement avant de continuer

## Selection de la type de la machine

![Selection de la type de la machine](images/init3.png)

![L'erreur si deux interfaces réseau ne sont pas configuré](images/init2.png)

## Configuration réseau initial

La configuration réseau de la machine haut est fait via l'interface d'administration
de la machine bas. Par consequence cette section ne concerne que la machine bas. En
revanche si le réseau n'est pas au moins partiellement configuré sur la machine bas,
l'interface d'administration pourrait ne pas être disponible. Par consequence un 
configuration initial du réseau de la machine bas est fait à partir de la console 
de la machine.

Le premier étape est choisir si le réseau est static ou s'il utilise DHCP pour sa 
configuration. Le menu suivantte est utilisé afin de confirmer ce choix

![Selection de reseau DHCP ou static](images/init4.png)

A ce point si DHCP a été choisi aucun autre configuration réseau est nécessaire et 
vous pouvez passer au section suivant.

Pour la configuration en IP static il faut rentrer l'adresse et netmask en format
CIDR. Dans le format CIDR le netmask est répresenté par integer entre 0 et 32 
representant des netmask avec entre 0 et 32 "1" a gauche et le reste du netmask
completer par des zéros.

Par exemple le netmask "255.255.255.0" est répresenté en format CIDR par "/24" et
le netmask "255.255.255.128" par "/25". Donc si notre ip est "10.0.2.15" et notre
netmask est "255.255.255.0" il est rentrer comme

![Configuration IP et netmask d'un IP static](images/init6.png)

dans l'interface de configuration au démarrage.

![Configuration du passerelle  avec un IP static](images/init7.png)

![Configuration DNS avec un IP static](images/init8.png)

![Configuration DNS avec un IP static](images/init9.png)

## Configuration SSH

Le configuration 

## En cas d'erreur d'initialisation du DSAS

L'erreur est humain, et le DSAS propose des moyens de récuperer des erreurs fait
à l'initialisation. Si la phase initial de l'installation  (utilisant la console)
n'est terminer, aucun configuration a été sauvé. Un simple rédemarrage de la
machine va permettre de reconfigurer de zéro. 

Si malheuresuement vous avez terminer l'installation mais il n'est pas correcte 
et l'interface d'administration n'est pas accessible, tout n'est pas perdu. En
revanche le DSAS est configuré afin de démarrer sans aucun interaction humain après
sa premiere configuration. Donc afin de récuperer d'un erreur il faut connecter
sur l'interface console.

Le l'utilisateur à utiliser sur la console est 'tc' et le mot de passe à utiliser,
si vous n'avez pas déjà modifier avec l'interface d'adminsitration, est comme plus
haut. Vous seriez presenter avec un console linux classic avec un minimum de fonctionalité
disponible. 

La commande nécessaire avec de réconfigurer le DSAS est

```
sudo /etc/init.d/services/dsas reconfig 
```

Vous seriez présenter avec les menus comme avant pour la réconfiguration. A la fin 
de la configuration n'oublie pas de déconnecté avec la commande

```
exit
```

## Premier connexion à l'interface d'administration

### Changement des mots de passe

### Finalisation des configuration de réseau

### Renouvellement de la certificate web

# Usage

## Application des changements

## Configuration réseau 

## Configuration web

## Configuration des services

## Configuration des certificates

## Configuration des taches

## Rédemarrage et arret

# Mantient en condition de sécurité

FIXME : Ajouter la liste des logiciels exposé et leurs vesrsion ici

FIXME : Discuter procedure de remplacement de l'iso 

## Processus de pull et build github

FIXME : Fournir une image de build tinycore preconfiguré

## Mise à jour binaire

## Mise à jour source

# Architecture détaillé

Cette séction inclut des détailles des mesures de sécurité mise en place afin
de garantir le niveau de sécurité du DSAS.

## Matrice de flux réseau détaillé

## Les comptes utilisateurs sur la DSAS

### Les droit d'ecriture de chaque utilisateur

### Les droit de connexion de chaque utilisateur

## Cloissonnement disque 

FIXME : Discuter sur le disque mounter en "noexec"

Un hardlink sous linux est exactement le même fichier dupliqué à un autre endroit. 
L'usage des hardlink entre les fichier du gichet haut du sas et le guichet bas 
pourrait permettre un simplication des l'architecture, car aucun moyen de tracer les
ficheirs téléchargé sera necessaire et ça sans augmentation de l'espace disque.

En revanche les hardlink doit réspecter les exigences d'acces entre les guichet haut
et bas. Quand un fichier existe dans les deux zones, il faut que

- L'utilisateur haut ne peut pas modifier le fichier visible dans le guichet bas
- L'utilisateur haut ne peut pas supprimer l'existance de la fichier dans le 
  guichet bas
- Que l'utilisateur haut pourrait supprimer l'existence de la fichier dans le 
  guichet haut

Avec les permissions suivante

| Perms      |  UID   | GID   |  Chemin
|------------|--------|-------|-------------------
| drwxrwx--- |  haut  | haut  |  dsas/haut
| -rw-r----- |  verif | share |  dsas/haut/fichier
| drwxrwx--- |  bas   | bas   |  dsas/bas
| -rw-r----- |  verif | share |  disas/bas/fichier

et un fichier /etc/group centenant 

```
verif:x:2000:
bas:x:2001:verif
haut:x:2002:verif
share:x:2003:verif,bas,haut
```

les exigences voulu sont respecté. Les script de verification DSAS ont été adapté
afin d'assurer ces coditions

## Moyens de Verification 

Il y a 3 type de verification des répository linux

* rpm - Les signature de chaque fichier RPM est verifié avec "rpm -K"
* repomd - Le fichier repomd.xml est verifié et seulement les hashes to chaque fichier est verifié
* deb - Actuellement non implementé

Il y a trois autres type de vérification 

* authenticode - Verifier avec Microsoft Authenticode signatures. 
* gpg - 
* openssl -

### Verification - rpm

Les détails - A completer

### Vérification - repomd

Les détails - A completer

### Vérification - authenticode

Pour la tye de vérification "authenicode" chaque fichier dans la dossier est verifiés contre les
certificates specifiés. Si aucun certificate authorité est specifié, le store de certificate est
utilisé incluant tous les certificates dans le store. Ceci pourrait augmenté les risques et il est 
beaucoup meiux de spécifier un seul certificate autorité pour la vérification

Si les signatures sont valable et signé par les certificates spécifiés, les fichiers sont mise à 
disponibilité sur le sas du bas de DSAS. Aucun sous-dossier est traité

Le logiciel osslsigncode [https://github.com/mtrojnar/osslsigncode] est utilisé pour la verification

### Vérification - gpg

Les signatures GPG pourrait être integré dans le fichier signé ou dans un fichier à part. Le DSAS
assume qu'un des moyens suivant est utilisé afin de signé un fichier

```
gpg --output <file>.gpg --sign <file>
gpg --output <file>.sig --detach-sig <file>
gpg --output <file>.sig -a --detach-sig <file>
```

Donc des signature detaché sont en deux fichiers <file> et <file>.sig, et des signature integrés 
sont dans des fichiers terminant comme <file>.gpg

### Verification - openssl

L'utilisateur doit avoir déja generé des clefs publique et privé pour la signature avec 

```
openssl genrsa -out key.pem 4096
openssl rsa -in key.pem -pubout > key.pub
```

Et le clef publique dans le fichier key.pub doit être associé avec le tache dans le DSAS. Les fichiers
sont signés comme

```
openssl dgst -sign key.pem -keyform PEM -sha256 -out <file>.sig -binaru <file>
```

Les signatures sont toujours stockés dans des fichiers séparé, et le DSAS assume que les signature
sont dans un fichier avec un extension .sig 

## Service OpenSSH

## Service web

FIXME: discuter l'usage de TLS et le group "repo" afin de respecté les droit
