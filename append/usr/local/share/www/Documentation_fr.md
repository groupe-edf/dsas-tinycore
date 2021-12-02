# Introduction

Le cloisonnement des infrastructures industrielles est essentiel pour limiter 
les possibilités d’attaques malveillantes. Ce niveau de cloisonnement limite 
fortement les capacités à automatiser la récupération des mises à jour de sécurité 
(MAJ OS, signatures SEP, MAJ logicielles) indispensables à tous systèmes sensibles. 
Les fichiers de configuration ou tout autre fichier sont également
difficiles à récupérer.

Généralement des clés USB sont utilisées pour injecter des fichiers dans les 
systèmes d’information.  Ce mode de transfert nécessite des interventions humaines 
(chronophages) et expose le système industriel à une contamination virale à chaque 
branchement. Des moyens organisationnels pourraient être mis en place afin de contrôler
les clefs USB à chaque utilisation, mais le risque de contamination est impossible
à exclure.

Nous avons donc besoin d'un moyen technique de transfert de fichiers d'une zone non
sensible vers nos infrastructures industrielles, et de contrôler systématiquement tout
transfert afin d'exclure les risques de malveillance. Le "Dynamic Security Access Service" 
(DSAS) a pour but de mettre en place ce moyen de transfert sécurisé. 

Le DSAS a pour objectif de télécharger les mises à jour de sécurité, contrôler leurs 
intégrités et de les mettre à disposition dans les systèmes d’information. Il a également 
pour but la suppression de l'usage de clefs USB sur des infrastructures industrielles, et 
donc  inclut la capacite de transfert des fichiers signé par des personnes habilités.
Le DSAS assure également une rupture de session protocolaire entre les différentes
zones de sécurité dans un contexte de défense en profondeur.

## La principe de vérification des signatures

Le moyen principal de vérification des fichiers transmis par le DSAS est la vérification
des signatures. Chaque fichier permis de passer par le DSAS pourrait être vérifier par
une signature cryptographique. 

Le DSAS n'est pas le premier à proposer ce moyen de vérification dans un sas de transfert
de fichier et [par exemple le produit de SECLAB permets de faire](https://www.seclab-security.com/seclab-securing-systems/)
Le problème est que ces moyens requièrent l'intervention de quelqu'un afin de signer chaque 
fichier reçu avant leurs transmission. Un produit comme Symantec End Point Manager produit 
approximativement 4000 fichiers par jours à transmettre. Donc c'est illusoire à penser que 
quelqu'un va contrôler chacun de ses fichiers avant de signer et les transmettre.

Le DSAS prendre une autre approche, en donnant confiance aux signatures des fichiers fournaient par
certains éditeur de logiciel, et permettant le transfert de ces fichiers. En revanche il existe 
plusieurs moyens de signature utilisé par les éditeurs de logiciels, et le DSAS est requis 
d'avoir une moyen de vérifier chaque type de signature utilisé par les éditeurs de logiciel

### La chaine de confiance

Le problème avec une vérification de signature est de savoir et limiter à qui on donne confiance.
Pour ça la chaine de confiance de la signature est importante à connaitre. Cette chaine de confiance
pourrait être lié à des "Autorités de certification" (ou CA) dans la cas des certificats de type X509,
soit à une confiance distribué avec des certificats eux-mêmes qui sont signé entre eux dans la
cas des certificats PGP. Dans le cas des certificats PGP, la "toile de confiance" est implicite
et il se passe avant l'inclusion des certificats dans la DSAS. Pour les certificats basés sur la
norme X509 la chaine de confiance est inclut dans chaque fichier signés. Par exemple le certificat
utilisé pour la signature d'une fichier est lui-même signé par un certificat intermédiaire, et
ce certificat intermédiaire est signé par l'autorité de certification. Le DSAS permet de définir
des taches de vérification limitant des fichiers permis à passer à une chaine de confiance complète
et pas seulement vérifier vis-à-vis des autorités de certification. Malheureusement, [les malveillantes
peut acheter des certificats de signature aussi](https://duo.com/decipher/attackers-are-signing-malware-with-valid-certificates).
est une vérification seulement avec un autorité de certification n'est pas un garantis stricte 
d'absence de malveillance. Le DSAS, si correctement configuré permets de strictement limiter les 
transfert à seulement un seul éditeur de logiciel, ou même un sous-division du éditeur de logiciel, 
minimisant les risques.

## Architecture

Les principes du DSAS sont les suivantes :

- Le DSAS n'est intégré dans aucun des deux domaines interconnectés, mais est
cloisonné des deux. Les connexions vers les DSAS doivent être strictement 
contrôlées. 
- Aucun service ou port réseau non utilisé ne doit être disponible. Les logiciels
non utilisés doivent être désinstallés.
- Le DSAS doit implémenter une rupture complète entre les deux domaines de sensibilité.
Ceci est implémenté par l'utilisation de deux machines distinctes pour les connexions
vers les deux zones de sécurité différentes, afin que la compromission de la machine 
interconnectée avec le zone non sensible ne mettra pas à risque le zone sensible.
- Plusieurs compte utilisateurs sur les machines du DSAS sont utilisés, avec les droits
d'accès distinct, afin que la compromission d'un compte, n'expose pas entièrement
les zones internes de chaque machine.
- Aucun fichier non contrôlé ne doit être visible dans la zone sensible. Les systèmes
fichiers des deux machines du DSAS doivent être distincte.
- Des vérifications doivent être faites par le DSAS avant de rendre disponible les
fichiers dans le zone sensible. Ces vérifications sont actuellement limitées à
des contrôles d'intégrité mais pourraient dans la futur inclure des contrôles des
menaces avec un moteur d'AV.
- Le maintien en condition de sécurité doit être assurer. Ceci veut dire que
l'ensemble des logiciels exposés à l'attaque doivent connus, une veille de sécurité doit 
être mise en place et des moyens pour pallier les vulnérabilités maitrisées.

Ces contraintes nous poussent vers un des principes d'architecture avec

- séparation du traitement des zones sensibles et non sensibles sur deux machines
distinctes.
- Utilisation d'une souche linux minimale avec le moins de logiciels installés possible.
Le choix d'utilisation de [Tiny Core Linux](http://tinycorelinux.net/) a été fait car 
cette souche est mise à jour régulièrement et l'installation minimale (de 12 mégaoctets) 
n'inclut que le noyau de linux, busybox et quelques scripts de démarrage. Aucun service
n'est démarré par défaut
- Des dépendances supplémentaires sont à éviter ; par exemple perl, python, … ne sont pas
installés et tout script utilisé par le DSAS est écrit en shell.
- Chaque machine utilisée dans le DSAS possède deux interfaces réseau distinctes, l'une 
d'entre elles sert à l'interconnexion entre les machines. Une des machines possède une 
connexion vers les zones sensibles et l'autre machine est connectée à la zone non sensible.
- La sens d'instanciation des flux réseau va toujours du plus sensible vers le moins
sensible, et aucun port réseau sur l'interface la plus sensible n'est exposé de la machine 
la moins sensible. Ainsi seule la machine de la zone sensible peut télécharger des flux 
provenant de la zone sensible, la zone non sensible ne peut envoyer des flux vers la zone 
sensible.
- L'ensemble de l'administration doit se faire à partir de la zone sensible. Aucune 
administration ne peut se faire à partir de la zone non sensible. 
- Plusieurs comptes de service sont créés avec le compte "haut" étant le seul avec les droits
de déclencher un téléchargement depuis le zone moins sensible, le compte "verif" étant le 
seul avec les droit de transfert entrée un guichet haut et bas de chaque machine, et le 
compte "bas" étant le seul avec les droit d'accès au guichet bas de chaque machine depuis 
le zone plus sensibles. Le compte "verif" n'est pas accessible depuis l'extérieur de la
machine.

L'architecture du DSAS simplifiée est alors

![DSAS architecture](fr/DSAS.png)

où les flèches représentent des flux réseau ou applicatifs et les directions de ces flèches
sont le sens de l'initiation de ces flux

Un utilisateur administrateur est également ajouté. Cet utilisateur ne peut que connecté
depuis le zone sensible et un filtrage forte sur les machine avec les droits de connecter
sur cette compte est implémenté. Ceci est le seul compte avec les droits d'administration
sur les deux machines, et le compte root n'est accessible que depuis ce compte.

# Installation

Avec le DSAS séparé en deux machines, deux installations séparées sont nécessaires. Les deux
installations suivent la même logique. Dans la discussion suivante la machine connectée au
réseau non sensible est appelée la machine "haute" et la machine connectée au réseau sensible
est appelée la machine "basse". Une configuration initiale de chaque machine est nécessaire
depuis leur console propre, mais après cette phase initiale, toute la configuration est faite depuis
la machine basse.

Afin que la configuration se passe facilement il faut démarrer avec la configuration de
la machine haute, car même en phase initiale la machine basse doit prendre la main sur la
machine haute, et elle doit être configurée en premier afin d'être prête à accepter des ordres.

Dans les sections suivantes si ce n'est pas dit explicitement la configuration concerne les
deux machines.

## Configuration des machines virtuelles

### Choix des tailles des disques

Le DSAS a besoin de disques indépendants, un pour chacun des deux machines utilisées 
dans son implémentation. Donc le DSAS a besoin de deux fois plus de disques que le 
maximum utilisé pour les transferts. Le DSAS est configuré afin de faire des "miroirs" 
des disques à télécharger, et les anciens fichiers sont supprimés s'ils ne sont 
plus disponibles sur leur site de téléchargement. Donc seulement l'addition des espaces
utilisés par les sites externes est nécessaire, plus un peu de marge.

Les mises à jour de Windows des "Patch Tuesday" sont souvent une centaine de mégaoctets en
taille, donc multiplier ça par le nombre à garder représente potentiellement plusieurs 
gigaoctets. Pour les mises à jour de Symantec le besoin est de l'ordre de 150 mégaoctets
pour IntelligentUpdate mais de l'ordre de 50 gigaoctets pour LiveUpdate.

Chaque repositoire de Linux pourrait avoir jusqu'à 50 gigaoctets, donc si on 
transfère des mises à jour de linux notre besoin de disque peut vite exploser. Dans Les
configurations suivantes, nous avons utilisé une taille de 50 gigaoctets, mais nous
recommandons au moins 500 Go pour chaque machine du DSAS.

### Création des machines virtuelles

Le DSAS est fourni sous forme d'une ISO à utiliser en "live CD". Ceci veut dire que le 
système exploitation doit démarrer toujours sur ce disque ISO. La grand avantage de
cela est que les mises à jour du DSAS vont être très simples en exploitation et se résument
par l'arrêt du DSAS, le remplacement de l'ISO et le redémarrage.

L'ISO du DSAS est une souche linux en 32 bits, et la machine virtuelle est à configurer
en conséquence. Par exemple, sous VirtualBox la configuration initiale devrait être

![Création d'une VM sous VirtualBox](fr/vbox1.png)

un minimum de 256 mégaoctets est nécessaire afin de démarrer le DSAS. Mais en 
fonctionnement le DSAS pourrait utiliser plus de ressources et nous recommandons
l'utilisation de 1 gigaoctet de mémoire. 

Le DSAS n'a pas besoin d'un format spécifique de disque. Nous avons choisi ici d'utiliser 
le format par défaut proposé par VirtualBox.

![Configuration du disque sous VirtualBox](fr/vbox2.png)

Après il faut configurer le disque de démarrage du DSAS en mettant le disque ISO du
DSAS en maître primaire IDE

![Boot sur l'ISO sous VirtualBox](fr/vbox3.png)

Si le disque de démarrage est mal configuré, le DSAS ne pourrait pas démarrer. 

### Interconnexion réseau entre les machines du DSAS

Les machines virtuelles sont à configurer avec deux cartes réseaux. La première carte 
réseau est toujours utilisée pour les connexions vers les réseaux externes du DSAS
et leur configuration dépendent de l'environnement où est installé le DSAS. 

La deuxième carte réseau est toujours utilisée pour l'interconnexion entre les 
deux machines du DSAS, et ce réseau est un réseau statique en "192.168.192.0/24".
Plusieurs moyens pourraient être mis en place pour la configuration du réseau
d'interconnexion, notamment si un pare-feu supplémentaire est à placer sur ce
lien (ceci ne semble néanmoins pas vraiment nécessaire). Nous conseillons l'usage un 
réseau interne à l'hyperviseur configuré en VirtualBox comme

![Configuration réseau d'interconnexion sous VirtualBox](fr/vbox4.png)

Nous sommes maintenant prêts a démarrer la machine pour la première fois. 

Cette étape démarre ainsi une initialisation qui se fait en deux phases : la première à 
l'aide de la console Linux, et la deuxième à partir de l'interface d'administration en https.

## Premier phase d'initialisation

Cette phase est faite depuis les consoles des machines, car avant la première
configuration il n'y a aucun garanti que les machines soit visible depuis l'extérieur.
Il faut faire un minimum de geste sur la console afin de démarrer la configuration réseau 
avant de continuer dans une deuxième phase depuis l'interface d'administration du DSAS.

### Formatage des disques

Au premier démarrage le DSAS nous demande de formatter son disque. Un menu est
présenté avec l'ensemble des disques trouvés connectés au DSAS. Ceci se présente
comme

![Formatage des disques DSAS](fr/init1.png)

La navigation dans ce type de menu est faite avec les clefs suivantes

- les flèches - déplacement du curseur
- Espace - sélection d'une option
- Entrée - Continuer

Utiliser "Espace" afin de sélectionner le disque, ici "/dev/sda", et "Entrée" 
afin de démarrer le formatage du disque. Après le formatage, la machine 
redémarrera automatiquement avant de continuer

### Sélection du type de machine

La prochaine étape consiste à sélectionner si la machine du DSAS va être configurée 
en machine haute ou basse. Le menu 

![Sélection du type de machine](fr/init3.png)

est utilisé afin de présenter la sélection du type de machine. Si la machine 
a été configurée avec seulement une carte réseau à ce point le DSAS va arrêter
sa configuration avec l'erreur

![L'erreur si deux interfaces réseau ne sont pas configurées](fr/init2.png)

Dans ce cas arrêter la machine et ajouter une carte réseau dans l'hyperviseur.

### Configuration du réseau initial

La configuration réseau de la machine haute est faite via l'interface d'administration
de la machine basse. Par conséquence cette section ne concerne que la machine basse. En
revanche si le réseau n'est pas au moins partiellement configuré sur la machine basse,
l'interface d'administration pourrait ne pas être disponible. Par conséquent une 
configuration initiale du réseau de la machine basse est faite à partir de la console 
de la machine.

La première étape consiste à choisir si le réseau est statique ou s'il utilise DHCP pour sa 
configuration. Le menu suivant est utilisé afin de confirmer ce choix

![Sélection du réseau DHCP ou statique](fr/init4.png)

A ce point si le DHCP a été choisi aucune autre configuration réseau n'est nécessaire et 
vous pouvez passer au section suivante.

Pour la configuration en IP statique il faut rentrer l'adresse et le netmask en format
CIDR. Dans le format CIDR le netmask en IPv4 est représenté par un entier compris entre 
0 et 32 représentant le nombre de bits utilisés pour coder la partie NetId.

Par exemple le netmask "255.255.255.0" est répresenté en format CIDR par "/24" et
le netmask "255.255.255.128" par "/25". Donc si notre ip est "10.0.2.15" et notre
netmask est "255.255.255.0" il est rentré comme

![Configuration IP et netmask d'un IP static](fr/init6.png)

dans l'interface de configuration au démarrage. La syntaxe de l'adresse IP rentrée est 
validée avant de continuer. Si elle n'est pas dans un format acceptable le même menu vous 
sera représenté en boucle.

Si la machine d'administration n'est pas sur le même sous-réseau que le DSAS il faut
configurer une passerelle par défaut. Sinon laisser vide afin d'empêcher toute connexion 
au DSAS depuis l'extérieur du sous-réseau.

![Configuration du passerelle avec une IP statique](fr/init7.png)

Deux éléments sont nécessaires pour la configuration du DNS. Premièrement le domaine
de recherche. Ici un domaine de recherche "edf.fr" est utilisé

![Configuration DNS avec une IP statique](fr/init8.png)

avec ce domaine de recherche les hosts "ntp1" et "ntp1.edf.fr" seront équivalents.
Après il faut définir des serveurs de noms, responsables pour la conversion des 
adresses DNS en IP. Par exemple 

![Configuration DNS avec une IP statique](fr/init9.png)

Plusieurs adresses IP séparées par des espaces pourraient être rentrés, donnant une 
liste de  serveurs de noms en ordre de leur préférence d'usage.

### Configuration SSH

La machine haute n'a pas besoin de configuration SSH en phase initiale. Le configuration du SSH 
requiert la création de clefs SSH pour deux utilisateurs du DSAS;

- l'utilisateur __tc__ en tant que compte à privilèges permettant de travailler en shell 
avec les deux machines, et 
- l'utilisateur __haut__ permettant l'interconnexion en sftp avec l'utilisateur bas de la 
machine haute.

La création des clefs est automatique, mais il faut transférer les clefs autorisées sur la
machine haute. Si la machine haute n'est pas visible de la machine basse elle va attendre 
avec le message

![Attente machine basse pour la machine haute](fr/init11.png)

La raison principale afin de voir cet écran pourrait être que la machine haute n'est
pas démarrée. Mais l'interconnexion réseau entre les deux machines pourrait également être
à revoir.

Dans la phase initiale, il n'y a aucune clef SSH pour les SSH sans mot de passe. Donc il 
faut entrer le mot de passe utilisateur à privilège __tc__ dans la fenêtre.

![Entrée du mot de passe pendant la configuration SSH](fr/init10.png)

Par défaut le mot de passe du DSAS est __dSa02021DSAS__ mais à la première utilisation de
l'interface d'administration vous serez forcé de changer ce mot de passe.

Ceci est la dernière étape de la configuration initiale sur la console. La deuxième phase 
de la configuration initiale devrait être faite avec l'interface d'administration.

### En cas d'erreur d'initialisation du DSAS

L'erreur est humaine, et le DSAS propose des moyens de récupérer des erreurs faites
lors de l'initialisation. Si la phase initiale de l'installation (utilisant la console)
n'est terminée, aucune configuration ne sera sauvegardée. Un simple redémarrage de la
machine va permettre de reconfigurer à partir de zéro. 

Si malheureusement vous avez terminé l'installation mais qu'elle n'est pas correcte 
et que l'interface d'administration n'est pas accessible, tout n'est pas perdu. Cependant 
comme le DSAS est configuré pour démarrer sans aucune interaction humaine après
sa première configuration, il vous faudra vous connecter à partir l'interface console pour 
pouvoir accéder de nouveau au menu de configuration.

L'utilisateur à utiliser sur la console est 'tc' et le mot de passe à utiliser,
si vous ne l'avez pas déjà modifié avec l'interface d'administration est comme plus
haut. Un console linux classique avec un minimum de fonctionnalités
disponibles vous sera présenté. 

La commande nécessaire avec de reconfigurer le DSAS est

```shell
$ sudo /etc/init.d/services/dsas reconfig 
```

Le menu de configuration vous sera alors présenté. A la fin de la configuration n'oubliez 
pas de vous déconnecter à l'aide de la commande

```shell
$ exit
```

## Première connexion à l'interface d'administration

L'adresse de connexion à l'interface d'administration du DSAS va dépendre de votre installation
mais sans NAT entre vous et le DSAS, l'adresse IP sera celle entrée précédemment. En revanche le
port d'administration du DSAS est toujours le __port 5000__. Donc si votre IP est 10.0.15.2 
comme utilisé dans l'exemple ci-dessus vous devrez vous connecter à https://10.0.2.15:5000 pour 
l'interface d'administration du DSAS.

L'interface d'administration est en HTML5 avec des fonctions récentes de javascript. Donc
un navigateur récent (après 2016) sera nécessaire afin d'utiliser l'interface. Si vous n'arrivez 
pas à vous connecter, c'est soit qu'il y a un problème de routage entre vous et le DSAS et il faut 
revoir les  configurations des routeurs entre vous et le DSAS, soit que la configuration du réseau 
du DSAS précèdent est fausse. Dans ce cas il faut référer à la section [En cas d'erreur d'initialisation 
du DSAS](#en-cas-derreur-dinitialisation-du-dsas). 

Le certificat SSL utilisé par le DSAS en phase initiale est auto-signé et il sera nécessaire 
d'accepter son usage dans votre navigateur. Si vous avez réussi à vous connecter à l'interface
d'administration du DSAS l'écran de connexion suivant vous sera présenté :

![Ecran de connexion du DSAS](fr/DSAS1.png)

L'utilisateur privilégié sur le DSAS est l'utilisateur __tc__, et le mot de passe par défaut
est le __dSaO2021DSAS__. A ce point connectez-vous sur l'interface d'administration.

### Les basics de l'interface d'administration

#### Le bouton `Appliquer`

En haut des pages de l'interface d'administration vous trouvez un bouton `Appliquer` souligné
en rouge. Ce bouton est très important. Aucune modification faite via l'interface 
d'administration ne sera permanente et aucune, sauf les changements de mot de passe, ne sera 
appliquée tant que le bouton n'est pas utilisé. Ce bouton effectue une sauvegarde permanente 
des changements effectués et les applique. De cette façon les erreurs majeures peuvent être 
facilement supprimées avec un simple redémarrage tant qu'elles ne sont pas appliqués. 

#### Arrêter et Redémarrer

Le DSAS peut être arrêté et redémarré sans crainte car l'ensemble du code exécutable est
sur l'image ISO du DSAS. Les taches du DSAS en cours seront interrompues, mais seront reprises au
redémarrage. Les fonctions d'arrêt et redémarrage sont disponibles dans le menu `Système` du
DSAS, comme

![Menu système du DSAS](fr/DSAS8.png)

#### Sauvegarde et Restauration

La configuration actuellement appliqué du DSAS peut être sauvegardée en utilisant le bouton dans
la menu ci-dessus. En sélectionnant vous seriez demandé d'entrée un mot de passe pour la 
sauvegarde, comme

![Menu d'entrée de mot de passe de sauvegarde](fr/DSAS24.png)

Les sauvegardes des deux machines du DSAS sont alors chiffré en `bcrypt` avec ce mot de passe et
archivé ensemble. Si vous ne rentrée pas de mot de passe de sauvegarde, les fichiers sera archivés
sans l'étape de chiffrement.

Il est fortement conseillé de chiffrer ces archives, parce qu'il contient la configuration complete
du DSAS, les certificats SSL et les éléments secrets SSH. Le mot de passe n'a pas besoin être le même 
mot de passe que le DSAS. Les mots de passes des utilisateurs ne seraient pas restauré.

En cas de restauration le même mot de passe sera demandé, et donc garder le précieusement. En cas
de restauration la configuration sera appliqué immédiatement. Ceci pourrait empêcher l'accès au DSAS, 
particulièrement si la configuration réseau n'est plus à jour. Dans ce cas référer à la section [En cas 
d'erreur d'initialisation du DSAS](#en-cas-derreur-dinitialisation-du-dsas).

#### Déconnexion automatique

Le DSAS est configuré afin de vérifier les droits de connexion à chaque opération, si plus de
10 minutes séparent une opération de la suivante, vous serez automatiquement déconnecté avec
la message suivant :

![Ecran de déconnexion automatique du DSAS](fr/DSAS3.png)

En cliquant `Ok` sur ce message vous serez redirigé vers l'écran de connexion du DSAS.

### Changement initiale des mots de passe

Si ceci est votre première connexion au DSAS, un message d'erreur sera affiché et après, 
l'écran suivant vous sera présenté :

![Ecran de changement des mots de passe initiale](fr/DSAS2.png)

A votre première connexion, tous les mots de passe sont à changer. Il est impossible de 
continuer avec l'interface d'administration sans modifier les mots de passes. 

L'écran de changement de mots de passe comporte 4 lignes. Sur la première, le mot de
passe existant de l'utilisateur __tc__ doit être rentré. Les trois autres lignes 
concernent les utilisateurs suivants :

- __tc__ - L'utilisateur administrateur du DSAS. Il a tous les privilèges sur le DSAS y compris
le doit de devenir __root__. Si `ssh` est actif pour l'utilisateur __tc__ il peut se connecter
avec une interface `ssh` afin de faire de la maintenance avancée sur la DSAS.
- __bas__ - Cet utilisateur n'a qu'un seul rôle. Si le DSAS est configuré avec 
`ssh` pour l'utilisateur __bas__ il aura le droit de se connecter en `sftp` et seulement en `sftp`
depuis la zone sensible. Ceci pourrait être utile pour la récupération des fichiers transmis
par le DSAS dans certains scenarios. Ne seront présentés à cet utilisateur que des fichiers vérifiés 
par le DSAS et un [chroot](https://fr.m.wikipedia.org/wiki/Chroot) est utilisé afin d'empêcher 
l'utilisateur de voir autre chose.
- __haut__ - Cet utilisateur comme l'utilisateur __bas__ est utilisé pour une connexion en `sftp`
depuis la zone non sensible afin de permettre la dépôt de fichiers directement sur le DSAS. Il est
également cloisonné et ne peut voir qu'une zone de dépôt de fichiers. __L'utilisation de cette
fonctionnalité est fortement déconseillés__ car elle ouvre la possibilité d'attaques contre le DSAS

Donc, en configuration normale seulement l'utilisateur __tc__ est à utiliser. Mais les trois
mots de passe sont néanmoins à modifier afin d'éliminer l'ensemble des éléments secrets par 
défaut. Les mots de passe des utilisateurs __bas__ et __haut__ peuvent toujours être modifiés 
depuis cette interface et si vous ne pensez pas utiliser les fonctions `sftp`, il est recommander 
de choisir des mots de passe longs et aléatoires pour ces utilisateurs __bas__ et __haut__.

Les limitations imposées sur les mots de passe sont 

- ils ont au moins 8 caractères de long (12 recommandés)
- ils ne contiennent pas d'espaces ni de tabulations
- Ils contiennent au moins 3 types de caractères (majuscule, minuscule, nombre, caractère spécial)

Rentrez vos nouveaux mots de passe et cliquez sur `Modifier les mots de passe`. 

![Ecran en cas de modification réussie de changement des mots de passe](fr/DSAS4.png)

A ce point il est recommandé d'appuyer sur le bouton `Appliquer` afin de rendre ces 
modifications permanentes. Sinon au prochain redémarrage les anciens mots de passe seront 
demandés.

### Configuration des réseaux

L'écran de configuration du réseau est accédé depuis le menu `Configuration` du DSAS, comme 
suivant :

![Menu de configuration réseau du DSAS](fr/DSAS5.png)

en cliquant dessus l'écran suivant vous sera présenté 

![Ecran de configuration réseau du DSAS](fr/DSAS6.png)

Le configuration réseau du DSAS est séparé en deux parties. Le réseau connecté vers le réseau 
sensible dénommé __bas__ et le réseau vers le réseau non sensible dénommé __haut__.  Chacun
de ces deux configurations pourraient être accédés en cliquant sur la flèche située à côté du type
de réseau, comme

![Ecran de configuration réseau du DSAS déroulé](fr/DSAS7.png)

Le configuration du réseau __bas__, précédemment entré est visible dans ce menu. Vérifier les
configurations, modifier si nécessaire et appuyer sur  `Sauvegarder des changements`.

Une synthèse des formats des entrées sur cette pages sont

- Si l'option DHCP est sélectionnée les autres champs pour la configuration réseau sont ignorés sur cette
interface.
- Les adresses IP, sont au format IPv4 comme NNN.NNN.NNN.NNN
- Si un netmask est nécessaire il est rentré au format CIDR. Dans le format CIDR le netmask est 
représenté par un entier compris entre 0 et 32, représentant la taille du NetId. 
Par exemple le netmask "255.255.255.0" est 
représenté en format CIDR par "/24" et le netmask "255.255.255.128" par "/25". 
- Le "DNS Domain" doit être un nom de domaine valable.
- Plusieurs adresses IP séparées par des retours chariot peuvent être rentrées, donnant une liste de 
serveurs de noms en ordre de leur préférence d'usage.

### Renouvellement du certificat web

Comme [discuté ci-dessus](#première-connexion-à-linterface-dadministration), le certificat SSL
utilisé par le DSAS par défaut est auto-signé. Ceci est également un élément secret à remplacer 
à la mise en service. L'interface d'administration du serveur web est dans le sous-menu `Web`
de l'onglet `Configuration` et se présente comme

![Menu de configuration du serveur web](fr/DSAS9.png)

L'onglet de renouvellement est accédé en cliquant sur la flèche à gauche de `Renouvellement du 
certificat, et se présente comme

![Menu de configuration du serveur web](fr/DSAS13.png)

Les champs à remplir pour le renouvellement sont des champs définis par la norme [RFC5280]
(https://datatracker.ietf.org/doc/html/rfc5280.html).

- __C__ - Ce champ est le pays de l'organisation responsable du serveur. Il est obligatoire
codé sur deux lettres comme défini dans le RFC5280. Le code pour la France est __FR__.
- __O__ - L'organisation responsable pour le serveur. En France est obligatoirement le
nom du société enregistré avec INSEE et doit être tout en majuscule.
- __OU__ - Un identifiant of le sous organisation responsable pour le serveur. Les certificats
signés en France doit inclure les KBIS, par exemple ici '0002 552081317' est un KBIS d'EDF.
- __CN__ - Pour un serveur, comme le DSAS ceci est obligatoirement le nom DNS du serveur
- __S__ - Un champ libre pour la région du siège social de L'entreprise. Il est optionnel
- __L__ - Un champ libre pour la ville du siège social de L'entreprise. Il est optionnel

Vous pouvez maintenant cliquer sur le bouton `Renouvellement certificat` et un certificat
sera généré. En revanche il ne sera pas utilisé par le serveur jusqu'au prochaine fois que 
vous avez cliqué sur `Appliquer`. Le certificat publique et Requête de signature (CSR) pourrait
être téléchargé en cliquant sur le bouton ![](fr/DSAS11.png).

## Configuration des services

Autre que le service web d'administration et service web de repositoire, il y a 3 services
qui pourrait être démarrer sur les machines du DSAS;

- Un serveur OpenSSH pour les connexions depuis l'extérieur,
- Un client ntpd pour la mise à l'heure des machines, et
- Un client syslogd pour les logs d'administration locale et distante

![Menu de configuration du serveur web](fr/DSAS16.png)

### Configuration de la service OpenSSH

En plus que le serveur openssh sur la machine haut utilisé pour les communications 
interne entre les deux machine du DSAS, l'administrateur du DSAS peut choisir d'ouvrir 
d'autre service de SSH depuis le zone sensible et/ou non-sensible.

Le serveur OpenSSH n'est jamais démarrer avec des accès ouverts à tous les utilisateurs sur 
le DSAS. Il faut explicitement donner l'accès a chaque utilisateur, et cet accès n'est valable
que depuis certain zones de sécurité. Par exemple, ci-dessus le service OpenSSH est coché est 
l'utilisateur __tc__  peut connecté que depuis des adresses IP dans le sous-réseau 10.0.2.0/24. 
Les utilisateurs bas et haut n'ont aucun droit d'accès.

Les adresses d'écoute pour chaque utilisateur peuvent être très complexe avec plusieurs adresses 
possible séparées par des virgules. Un exemple complexe pourrait-être

```
10.0.2.1,10.0.2.128/25,!10.0.2.129
```

ou l'adresse 10.0.2.1 et le sous réseau 10.0.2.128/25 pourraient accéder au DSAS, mais l'adresse
10.0.2.129 est interdit de faire. Par défaut aucun accès est donné, et si l’adresse d'écoute 
pour un utilisateur est blanc, le serveur OpenSSH n'est même pas démarrer sur l'interface 
réseau du DSAS concerné.

Chaque utilisateur ne peut que connecter depuis certaines zones de sécurité :

- __tc__ - L'utilisateur __tc__ ne peut que connecter depuis la zone sensible et peut 
connecter en ssh, scp et sftp
- __bas__ - L'utilisateur bas ne peut que connecter en sftp depuis la zone sensible. Cette
fonctionnalité de sftp pourrait être utilisé pour remplacer le serveur http de dépôt
(ou en complément). Il n'a que accès à la zone du DSAS avec les fichiers vérifiés et ne
peut pas accéder ailleurs dans le DSAS.
- __haut__ - `Utilisation du compte haut en SSH en fortement déconseillé`. La raison qu'il est 
déconseillé est qu'il ne respecte pas le sens de l'ouverture des flux de la zone plus sensible 
vers la zone moins sensible. Mais en absence d'autre moyen de téléchargement ce compte ouvre
la possibilité depuis la zone non sensible à déposer des fichiers sur la machine haute du DSAS.
L'utilisateur __haut__ n'a accès que en sftp et que à la zone du DSAS avec les fichiers non
vérifiés.

Si le service SSH est activé vers une zone le port 22 est ouverte sur la machine du DSAS
concernée.

### Client syslogd

Si le service `syslogd` du DSAS est activé, des logs des services sont fait localement au DSAS.
Il est également possible à définir un serveur distant pour le service rsyslogd pour des logs 
en UDP sur la port 514. 

A noter que le service syslogd est fourni par BusyBox, et l'implémentation de syslogd de BusyBox
n'inclut pas la possibilité de chiffrement en TLS sur la port 6514. Donc d'autre moyen de 
sécurisation de cette flux sont à mettre en place.

L'utilisation de la service syslogd n'ouvre pas un port sur le DSAS, mais seulement une flux
vers une serveur distante.

### Client ntpd

Le DSAS inclut la possibilité de synchroniser via le protocole ntp. Un ou plusieurs hôtes ntp
pourraient être configuré. Les adresses des hôtes ntp pourraient être des adresses IP ou des
nom de hôte comme fournit par le DNS. Dans le deuxième cas le DNS doit-être configuré 
comme discuté dans la section [Configuration des réseaux](configuration-des-réseaux).

Utilisation de ntp n'ouvre pas un port sur le DSAS mais seulement des flux vers des serveurs 
distants

# Exploitation du DSAS

## Statut des machines

La page de statut des taches et les machines et la page d'entrée dans la DSAS et la page 
principale. Elle est accédée en cliquant sur `DSAS` dans la menu en tête des pages et se 
présente commande

![Page de statut des taches et les machines](fr/DSAS14.png)

La page est divisé en deux section; en haut la statut des machines du DSAS en en bas la statut
des taches du DSAS. Trois statistiques sont donnés pour les deux machines du DSAS.

- __L'usage disque__ - L'occupation total des disques de DSAS sont montrés. Si les disques 
sont plein ça sera impossible de correctement télécharger et vérifier des fichiers. Donc il
faut surveiller périodiquement l'état des disques. Logiquement si les taches n'ont pas changés,
l'usage des disques ne devraient pas changer non plus, mais si une des taches soudainement
augmente son usage des disques ça sera facile à retrouver en manque. Un disque occupé à plus
de 80 ou 90% présente un risque de débordement.
- __L'usage de la mémoire__ - Chaque tache sur le DSAS occupe de la mémoire de la machine.
Si le mémoire est rempli, la performance des taches sera impactée. Il faut surveiller que
la mémoire n'est jamais trop utilisé, mais tant qu'il en dessous de 90% il ne faut trop 
s'en occupé. Avec l'architecture du DSAS, presque 200Mo est utilisé par le système 
d'exploitation.
- __Loadavg__ - Le "Load average" est un concept d'Unix donnant une idée sur l'occupation des
ressources de calcul de la machine. Un "Load Average" de "1" veut dire que l'équivalent 
d'un cœur du processeur est complètement occupé. Donc l'occupation total des ressources
de calcul de la machine est à la point ou le "Load average" est égale à la nombre de cœur
de la processeur. Sur la page de la DSAS le "Load average" est présenté de manière 
logarithmique et avec un échelle avec le nombre de cœur de la processeur à 50% de la 
longueur de la barre de statut. Si le barre de statut est plus longue que la moitie, il y
a peut-être un problème avec le DSAS ou pas suffisamment de ressources de calcul. Le premier
chose à refaire dans ce cas est de redémarrer le DSAS afin de voir si le problème 
disparaitre.

Si la machine basse du DSAS n'est pas disponible vous seriez en impossibilité de connecter 
à l'interface d'administration. En revanche si la machine haute est défaillante, la page 
de statut vous informe avec l'écran suivante

![Page de statut, machine haute indisponible](fr/DSAS15.png)

## Statut des fichiers vérifiés 

Le statut des fichiers vérifiés est disponible directement en dessous les statuts des machines 
du DSAS, comme

![Page de statut des fichiers vérifiés](fr/DSAS25.png)

Le statut des vérifications des fichiers pourrait être sur plusieurs onglet. Le numéro de
l'onglet est croissant avec l’âge des vérifications. Le premier onglet est la semaine en cours,
le deuxième onglet la semaine dernière, etc.

Le statut de chaque fichier vérifié est donné sur une ligne de la page, et chaque ligne est 
composées de 4 éléments

- __Statut__ : En premier position on pourrait trouver le statut de la vérification
- __Hache__ : En deuxième position est une hache unique en MD5 du fichier. En cas de recherche
de menace ceci pourrait être utile afin de voir si le DSAS de laisser passer le fichier ou pas.
- __Date__ : La date de la vérification est donner en troisième position. La date est en format
`AAAAMMJJHHMMSS` ou `AAAA` est l'année, `MM` est le mois, etc. Les dates sont toujours données 
en format UTC.
- __Fichier__ : Et en dernier position le chemin vers le fichier est donné

Le statut pourrait prendre les valeurs suivantes

- `   Ok` : Tout les vérifications demandé ont réussi et le fichier a été mise à disposition
depuis le machine bas.
- `$$ Checksum fail` : Un test de checksum sur le fichier a échoué 
- `** Bad Sig` : Un des vérifications demandées a signalé une mauvaise signature
- `** Bad Interm Sig` : La vérification d'un certificat intermédiaire a échoué
- `** Bad RPM Sig` : La vérification de signature d'un fichier RPM a échoué
- `** Bad DEB Sig` : La vérification de signature d'un fichier DEB a échoué
- `** Not signed` : Le fichier n'est pas signé et ne pourrait pas être vérifié

le bouton bleu en haut des logs de vérification permettre de basculer entre un mode ou "tous le logs" 
sont visible ou un mode ou "que des erreurs" sont visible. Ceci permettre de rapidement identifiés 
les fichiers ayant eu des problèmes.

### Recherche dans les logs de vérification

 En cas d'identification d'un probleme ou vulnérabilité ça pourrait être nécessaire à chercher
 dans les logs de vérification, soit pour le nom d'un logiciel, soit pour sa signature MD5en En
 tant d'indicateur de compromission. Le DSAS fournit un dialog de recherche afin de trouver des
 entrees correspondant dans les logs de vérification. Taper le valeur à trouver dans la dialog 
 de recherche comme ci-dessous et la prochaine log correspondant sera sous-ligné 

![Recherche dans les logs de vérification](fr/DSAS33.png)

Tapant sur `Entrée` permit d'avancer entre les lignes de log correspondant à la valeur rechercher.
Si à partir de la position actuel il n'y a plus de ligne correspondant, Le DSAS recommence la 
recherche depuis la début des logs. En cas d'aucun correspondance, aucun ligne est sous-ligné 

## Configuration des certificats

Le DSAS est préconfiguré avec l'ensemble de certificats racines d'un souche linux classique. 
L'ensemble de ces certificats et d'autres certificats importés sont disponible depuis onglet
Configuration/Certificats comme vue ci-dessous

![Page de configuration des certificats](fr/DSAS17.png)

Les certificats installés dans chaque catégorie pourraient être vue en cliquant sur la
flèche à gauche de chaque catégorie et les détails de chaque certificat sont disponible
comme

![Page de configuration des certificats](fr/DSAS19.png)

Chaque certificat pourrait être téléchargé sur la poste d'administration en cliquant 
sur le bouton ![](fr/DSAS11.png). 

Les certificats sont soulignés de 4 façon différentes dépendant sur les caractéristiques
du certificat. 

- __Certificat CA__ - Avec un texte en noir. Le certificat est un certificat racine ou 
un certificat auto-signé. Les deux types de certificat se ressemble avec la différence étant 
la confiance ou pas donné au certificat.
- __Certificat Intermédiat__ - Avec un texte en bleue. Ce certificat n'est pas
un certificat racine, mais elle est signé par un autre certificat
- __Moins de 6mois à l'expiration__ - Avec un texte en orange/jaune. Ce certificat est à 
moins de 6 mois de l'expiration
- __Expiré__ - Avec un texte en rouge. Le certificat a déjà expiré. Ceci ne veut pas dire
qu'il n'est plus utilisable, mais il n'est pas valable pour des fichiers signés après la date
de expiration

Les certificatifs racines préinstallées pourraient être utiliser pour les vérifications 
du DSAS. Mais l'utilisation de ces certificats seule n'est pas suffisante, parce que

- Les certificats préinstallé n'incluent pas des certificats GPG utilisé par les dépôts linux
- La vérification seulement contre un certificat racine n'ai pas un garanti forte d'absence
de malveillance. [Les certificats de type "code signing" ont été abusés par les 
malveillantes](https://duo.com/decipher/attackers-are-signing-malware-with-valid-certificates) 
afin de signer des malware.

Donc idéalement il faut restreindre les vérifications par des vérifications des certificats
de type intermédiaires la plus proche de l'éditeur de logiciel voulu. Par exemple un
mise à jour de "Symantec Endpoint Protection" (SEP) comporte la chaine de confiance 
suivante

```
VeriSign Class 3 Public Primary Certification Authority - G5
-> Symantec Class 3 SHA256 Code Signing CA
  -> Symantec Corporation
```
Donc idéalement il faut vérifier les mises à jour de SEP avec le certificat racine 
`VeriSign Class 3 Public Primary Certification Authority - G5` et avec le certificat
intermédiate `Symantec Corporation` afin de limiter au maximum les fichiers qui 
pourrait être validé en tant que mise à jour de Symantec. Donc pour ces mises à
jour il faut charger le certificat `Symantec Corporation` dans le DSAS.

### Gestion des certificats X509

#### Identification des certificats X509

Les certificats X509 sont utilisés dans la vérification des binaires Windows, mais
également pour des fichiers signés par `openssl`. 

Depuis un poste de travail en Windows, avec un clic droit et en sélectionnant l'option
`Propriétés` nous pourrions voir le menu suivant

![Menu propriétés d'un binaire signé](fr/CERT1.png)

En cliquant sur `Détails` et après `Afficher le certificat` nous pourrions voir la
chaine de confiance suivante

![Chaine de confiance d'un binaire signé](fr/CERT4.png)

Ceci permet de valider le certificat racine et l'ensemble des certificats utilisés
pendant la signature des binaires.

#### Préparation des certificats X509

La plus importante pour la préparation d'un certificat pour l'importation dans le DSAS
est de savoir la provenance de la certificat. Idéalement le certificat est donné de 
manière sûr par l'éditeur de logiciel. Ce moyen de diffusion est souvent réalisé par
un moyen de télécharger le(s) certificat(s) depuis une site web de l'éditeur. Mais
ceci n'est pas toujours le cas, notamment pour Symantec comme ci-dessus.

A défaut de la distribution par site web, l'ensemble des certificats utilisés pour des
signatures de binaires Windows sont embarquées dans les binaires signés eux-mêmes. Donc si 
vous êtes __sûr__ de la provenance d'un binaire vous pouvez utiliser le binaire lui-même comme 
source de certificat.

Sur le même menu que ci-dessous sur l'onglet `Détails` nous pourrions voir

![Détails d'un certificat](fr/CERT5.png)

avec l'option de `copier dans un fichier`. Cette option permettre de Sauvegarder 
l'ensemble des certificats de la chaine de confiance. Il faut sélectionner de
sauvegarder le certificat en format X.509 encodé en base 64 comme 

![Export d'un certificat en base 64](fr/CERT7.png)

Un fichier avec le certificat sera sauvegardé sur votre poste de travail.

#### Cas spécial des certificats Symantec LiveUpdate

Les fichiers LiveUpdate de Symantec ne sont pas signées directement, ils sont 
plutôt des archives en format `7z` avec tous les métadonnées signés nécessaire à 
leur vérification. Dans chaque fichier de `LiveUpdate` un fichier avec l'extension
`.sig` pourrait être trouver, typiquement `v.sig`. Ce fichier contient les 
certificats qui doit être importés dans le DSAS pour la signature des fichiers 
de LiveUpdate. Tant que vous avez extrait le fichier `v.sig`, les deux Certificats
à importer peux être retrouver avec la commande

```shell
$ openssl pkcs7 -inform der -in v.sig -outform pem -print_certs | awk 'split_after==1{n++;split_after=0} /-----END CERTIFICATE-----/ {split_after=1}{if(length($0) > 0) print > "cert" n ".pem"}
```
sur une machine linux. A partir de la ligne de command Windows nous pourrions faire.

```shell
$ openssl pkcs7 -inform der -in v.sig -outform pem -print_certs -out certs.pem
```

et la fichiers `certs.pem` va contenir plusieurs certificats en format texte que vous pouvez
splitté en plusieurs fichiers avec l'aide d'un éditeur de texte.

En revanche, certains fichiers dans les archives sont relativement vieux, et leurs
signatures aussi. Par conséquence, plusieurs certificats sont nécessaires. En plus
les certificats racines utilisés pour ces signatures ne sont pas incluent dans les fichiers
mais intégrés directement dans SEP, voir [discuté ci-dessus](#vérification-symantec-liveupdate).

Afin de faciliter l'utilisation de Symantec LiveUpdate, et les autres éditeur de logiciel
typiquement utilisé avec le DSAS, les 10 certificats à installer sur le DSAS sont disponible
dans [le bundle de certificats ci-jointe](Certificates.zip).

### Gestion des clefs publiques SSL

Des clefs publiques ne sont pas vraiment des certificates, cas ils ne contient que l'object
cryptographique permettant verification de signature ou déchiffrement. Aucun information sur 
les organisation responasable pour les clefs, les limitation sur leurs utilisations est inclut
dans les clefs publiques SSL. Ces clefs sont utilisés dans les tâches __openssl__ ou __cyberwatch__

Parce-qu'il existe aucun chaine de confiance pour des clefs publique, il est essentiel de 
maitrise la manière que les clefs utilisé avec le DSAS sont récuperés.

### Gestion des certificats GPG

Les certificats GPG sont utilisé notamment pour la vérification des binaires
de linux, mais également pour d'autres fichiers signés par GPG (par exemple des
fichiers de configuration développé par les utilisateurs du DSAS). 

Les certificats GPG n'intègrent pas explicitement la chaine de confiance dans les
binaires signées. GPG utilise la concept de [toile de confiance](https://fr.wikipedia.org/wiki/Toile_de_confiance)
ou les certificats eux-mêmes sont validés entre eux. Ceci est en dehors du scope
du document et nous avons assumé que vous avez un confiance complet dans les certificats 
que vous avez choisi à télécharger sur le DSAS.

Afin de récupérer un certificat GPG, la seule solution est de retourner vers 
L’éditeur de logiciel concerné. Par exemple quelques exemples de certificat
des éditeurs de logiciels sont

- [La page des certificats de RedHat](https://access.redhat.com/security/team/key) 
contient [le certificat utilisé pour la signatures des binaires de Redhat depuis 
2010](https://www.redhat.com/security/data/fd431d51.txt)
- [La page des certificats de CentOs](https://www.centos.org/keys/) contient notamment 
[le certificat utilisé pour CentOS7](https://www.centos.org/keys/RPM-GPG-KEY-CentOS-7)
- [La page des certificats debian](https://ftp-master.debian.org/keys.html) contient
notamment le certicat de [Debian Bullseye](https://ftp-master.debian.org/keys/archive-key-11.asc)

### Importation d'un certificat dans le DSAS

Des certificats X509 et GPG pourraient être ajoutés au DSAS en cliquant sur le
![](fr/DSAS23.png) a droit de chaque catégorie de certificat. Un navigateur 
du poste de travail est ouvert afin de sélectionner le fichier à télécharger sur
le DSAS. Et une importation réussie est signalé par

![Importation de certificat réussi](fr/DSAS20.png)

Afin de confirmer la bonne importation du certificat dans le DSAS, il est 
recommander de regarder les détails du certificat importé, comme par exemple

![Détails du certificat importé](fr/DSAS21.png)

## Configuration des taches

Une nouvelle tâche pourrait être ajouter en cliquant sur le ![](fr/DSAS23.png) 
a droit de la page des taches. 

![Menu d'ajout des taches](fr/DSAS26.png)

En cliquant dessus nous sommes présentés avec un formulaire d'ajout de tâche comme

![Formulaire d'ajout d'un tache](fr/DSAS27.png)

- `Nom de la tâche` : Un nom donné à la tâche, qui n'est pas forcement unique
- `Sous-dossier utilisé par la tâche` - Les fichiers associé avec chaque tâche 
sont stocké dans un dossier à part sur le DSAS. Ce dossier devrait être unique 
pour chaque tache.
- `URI (pas de chargement si vide)` - L'adresse ou le DSAS va chercher les fichiers
associés avec une tâche. De laisser vide est permissible et dans ce cas il est assumé 
que les fichiers associés avec le taches doit-être déposé sur la DSAS par l'utilisateur.
le `URI` doit-être de la forme `protocole://site/dossier/` ou bien 
`protocole://site/dossier/fichier`. Les protocoles permis sont `sftp:`, `ftp:`, `ftps:`, 
`http:` et `https:`. Par exemple `ftp://noeysep3.noe.edf.fr/LiveUpdate/`. Le `/` à la
fin des `URI` avec un dossier est optionnelle mais recommandé.
- `Type de tache` - Le type de tache a utilisé. Les types de tache permis sont
  * `rpm` - La tâche est un dépôt de fichier en format rpm. L’ensemble des fichiers sont 
vérifier avec `rpm -K`. 
  * `repomd` - Comme le type `rpm`, mais le les fichiers `repomd.xml` est signé
permettant d'accélérer les vérifications. 
  * `deb` - Verification des dépot de type Debian.
  * `authenticode` - Les fichiers sont signés avec des signature de type `Microsoft`.
  * `liveupdate` - Les fichiers correspondant aux fichiers de mise à jour de 
Symantec LiveUpdate.
  * `cyberwatch` - les fichiers correspondant aux fichiers de signature fournit par 
  [CyberWatch](https://docs.cyberwatch.fr/fr/9_advanced_administration_guides/offline_administration/swarm/import_securitydb.html)
  * `openssl` - Tache permettant le transfert des fichiers signé par openssl
  * `gpg` - Tache permettant le transfert des fichiers signé par gpg.
- `Périodicité de la tâche` - A quel rythme est-ce que la tâche est exécuté
  * `jamais` - La tâche n'est jamais exécuté automatique, mais peut-être exécuté manuellement
  * `par heure` - La tâche est exécuté un fois par heure
  * `par jour` - La tâche est exécuté un fois par jour
  * `par semaine` - La tâche est exécuté un fois par semaine
  * `par mois` - La tâche est exécuté un fois par mois
- `Ajouter un certificat` - Les certificats par défaut et les certificats ajouté
par l'utilisateur sont disponible pour l'ajout à la vérification par le tache. Le type
de certificat doit être adapté à la type de tache. Chaque certificat sélectionné est
ajouté à la liste des certificats pour le tache, et pourrait être supprimé en 
cliquant sur le [](fr/DSAS35.png) à côté du certificat.

Un exemple de tache après ajout est 

![Exemple de tache ajouté](fr/DSAS31.png)

A côté de chaque tache, l'icone ![](fr/DSAS33.png) permets de modifier le tache, 
![](fr/DSAS35.png) permet de supprimer le tache, et ![](fr/DSAS34.png) permets 
à l'exécuter immédiatement. Le statut de la tâche et fournit via la couleur du titre 
de la tâche. En bleu, la tâche n'a pas été exécuté, en vert l'exécution de la tâche a réussi,
et en rouge l'exécution a échoué. La dernière exécution de la tâche est visible en ouvrant 
la tâche comme

![Exemple d'éxecution de tache réussi](fr/DSAS32.png)

# Maintien en condition de sécurité

## Analyse des risques principales du DSAS

Cette section discute des risques principaux sur le DSAS. D'autres risques existent, par
exemple la compromission de la site dépôt du DSAS, mais par l'architecture du DSAS
sont considéré comme nageable.

Les logiciels impactés par ces risques sont détaillés avec les numéros de version de 
chaque logiciel installé permettant facilement à voir si une mise à niveau d'un 
logiciel est nécessaire.

### Risque : Compromission du lien entre les deux machines du DSAS

| Risque      | Compromission du lien entre les deux machines du DSAS   |
| ----------- | ---------------------------------------------------------- |
| Criticité  | Critique                                                   |
| Commentaire | La rupture sur le lien entre les deux machines du DSAS est <br />la protection principale du DSAS. En cas de compromission <br />L'attaquant pourrait prendre la main sur la machine bas <br />depuis la machine haut. Ceci pourrait mettre en cause la <br />cloisonnement entre les zones de sensibilité. |

Logiciels impactés par ce risque

| logiciel    | version  |  commentaire                                                                      | 
|-------------|----------|------------------------------------------------------------------------------|
| openssl     | [1.1.1l](https://www.openssl.org/source/openssl-1.1.1l.tar.gz) | Que la fonctionnalité utilisé par ssh impacté |
| openssh     | [8.8p1](https://ftp.openbsd.org/pub/OpenBSD/OpenSSH/portable/openssh-8.8p1.tar.gz) | ssh et sftp utilisé |

### Risque : Attaque sur la vérification des signatures 

| Risque      | Attaque sur la vérification des signatures                 |
| ----------- | ---------------------------------------------------------- |
| Criticité  | Majeur                                                     |
| Commentaire | Si les logiciels utilisé pour les vérifications de signature <br />sont compris la passage d'un fichier malveillant par le DSAS.<br />Ceci mettra en cause l'objectif principale du DSAS, mais<br />sera limité aux attaques asynchrone.  |

Logiciels impactés par ce risque

| logiciel      | version  |  commentaire                                                                      | 
|--------------|----------|------------------------------------------------------------------------------|
| openssl      | [1.1.1l](https://www.openssl.org/source/openssl-1.1.1l.tar.gz) | Utilisé pour la vérification authenticode, LiveUpdate et OpenSSL |
| gnupg        | [2.2.27](https://www.gnupg.org/ftp/gcrypt/gnupg/gnupg-2.2.27.tar.bz2) | Utilisé pour la vérification RPM, DEB et GPG |
| libgcrypt    | [1.9.3](https://www.gnupg.org/ftp/gcrypt/libgcrypt/libgcrypt-1.9.3.tar.bz2) | Utilisé pour la vérification RPM, DEB et GPG |
| rpm          | [4.16.1.3](https://ftp.osuosl.org/pub/rpm/releases/rpm-4.16.x/rpm-4.16.1.3.tar.bz2) | Utilisé pour la vérification RPM |
| osslsigncode | [2.2.0](https://github.com/mtrojnar/osslsigncode/releases/download/2.2/osslsigncode-2.2.0.tar.gz) | Utilisé pour la vérification authenicode |

### Risque : Attaque sur le moyen de téléchargement des fichiers 

| Risque      | Attaque sur le moyen de téléchargement des fichiers       |
| ----------- | --------------------------------------------------------- |
| Criticité | Important                                                 |
| Commentaire | Tout interconnexion de téléchargement sont initié par le<br />DSAS, donc ce risque ne peut qu’être utilisé depuis<br />des machines bien spécifiques. Le risque ne peut pas être<br />utilisé afin de détourner la fonctionne principale du DSAS<br /> |

Logiciels impactés par ce risque

| logiciel     | version  |  commentaire                                                                      | 
|-------------|----------|------------------------------------------------------------------------------|
| openssl     | [1.1.1l](https://www.openssl.org/source/openssl-1.1.1l.tar.gz) | Que la fonctionnalité utilisé par ssh impacté |
| lftp    | [4.9.2](https://lftp.yar.ru/ftp/lftp-4.9.2.tar.bz2) | Utilsé pour http, https, ftp, ftps, sftp |
 
### Risque : Attaque contre l'authentification administrateur du DSAS

| Risque      | Attaque contre l'authentification administrateur du DSAS  |
| ----------- | --------------------------------------------------------- |
| Criticité | Important                                                 |
| Commentaire | La site d'administration du DSAS n'est disponible que depuis<br />le réseau sensible, et normalement par configuration du<br />DMZ ou le DSAS est installé accessible que depuis des machines<br />bien maitrisés. Donc le risque se limite à une attaque depuis<br />une console permis d'accéder au DSAS par quelqu'un non-habilité<br />de faire. Le risque la reconfiguration du DSAS permettant<br />d'entre des fichiers non voulus ou d'empêcher d'entre des<br />fichiers voulu. |

Logiciels impactés par ce risque

| logiciel     | version  |  commentaire                                                                      | 
|-------------|----------|------------------------------------------------------------------------------|
| php-cgi     | [8.0.1](http://tinycorelinux.net/12.x/x86/tcz/php-8.0-cgi.tcz) | Backend de la site d'administration |
| lighttpd    | [1.4.58](http://tinycorelinux.net/12.x/x86/tcz/lighttpd.tcz) | Backend de la site d'administration |
| cyrus-sasl-lite | [2.1.27](http://tinycorelinux.net/12.x/x86/tcz/cyrus-sasl-lite.tcz) | Authentification sur la site d'administration |
| site web DSAS |  [-](https://gitlab.devops-unitep.edf.fr/dsao-cyber/dsas---tinycore) | Backend et frontend de la site d'administration |

La site web du DSAS est développé spécialement pour ce projet. Un audit de code est en
cours et des correctifs proposé sera appliqué.

## Processus de build du DSAS

### Préparation d'une souche de build

Vous auriez besoin une machine de build. Le plus simple est d'utiliser la même souche
de build que utilisé par le DSAS lui-même. Par exemple la souche 
[CorePlus v12.x](http://tinycorelinux.net/12.x/x86/release/CorePlus-current.iso)
est utilisé actuellement pour la build du DSAS. Tant que vous avez mise en place
cette machine, vous auriez besoin un certain nombre d'outils afin de faire le build.

A ce point si vous êtes derrière un proxy pour l'accès à l'internet, il faut configurer
l'accès les variable d'environnement `http_proxy` et `https_proxy` comme 

```shell
export http_proxy=http://vip-users.proxy.edf.fr:3131
export https_proxy=http://vip-users.proxy.edf.fr:3131
```

Ça sera utile à ajouter ces deux lignes au fichier `~/.profile`  afin qu'il soit
configuré à chaque fois. Après, la commande

```shell
tce-load -wi compiletc rsync coreutils mkisofs-tools squashfs-tools git curl ncursesw-dev
```
va installer l'ensemble des outils nécessaire pour la build 

### Clavier français

Si vous avez un clavier français, le plus simple est d'ajouter 

```
setxkmap fr
```

au fichier `~/.xession` ou d'exécuter cette commande depuis un console en X11.

### Préparation d'un arbre de source DSAS

Pour cette étape il faut temporairement désactiver le proxy http en faisant

```shell
unset http_proxy
unset https_proxy
```

Le gitlab d'EDF est utilisé afin d'héberger la code source du DSAS. Le certificat
SSL utilisé pour ce site est signé par l'autorité de certification d'EDF, qui n'est 
pas installé par défaut dans la souche de build. Il pourrait être récupérer et installé
pour nos besoins avec les commandes

```shell
mkdir ~/.git-certs
wget -P ~/.git-certs http://crl-edf.edf.fr/ac/autorite_racine_groupe_edf.cer
cat >> ~/.gitconfig << EOF
[http "https://gitlab.devops-unitep.edf.fr"]
  sslCAInfo = ~/.git-certs/autorite_racine_groupe_edf.cer
EOF
```

Maintenant, nous sommes prêts à récupérer l'arbre de code source du DSAS avec la commande

```shell
git clone https://gitlab.devops-unitep.edf.fr/dsao-cyber/dsas---tinycore.git
```

Finalement, nous pourrions configurer les prochaines actions sur cet arbre à ignorer
le proxy http avec les commandes

```shell
cd dsas---tinycore
git config --add remote.origin.proxy ""
```

Nous pourrions maintenant rétablir les valeurs des variables d'environnement du proxy.

### Commande de build du DSAS

Après le build est fait avec la commande

```
./make.sh
```

Une image ISO est créée dans le fichier `work/dsas.iso`. Nous pourrions garder les fichiers 
temporaires du build avec option "-keep". Ceci est utile afin de voir pourquoi quelque
chose a été mal installé sur le DSAS, sans être obliger à démarrer un serveur avec le DSAS.

Afin de faire le build d'un package à partir du code source (voir les fichiers `pkg/*.pkg`)
une commande comme

```
./make.sh -build gnupg
```

est utilisé. Afin de nettoyer les fichiers utilisé pendant le build vous pouvez faire

```
./make.sh -clean
```

Les ISOs du DSAS sont gardés, mais l'ensemble des fichiers intermédiaire 
sont détruit. Afin de complétement nettoyer le build utiliser la commande

```
./make.sh -realclean
```

est utilisé. 

## Mise à jour binaire

Pour une mise à jour binaire du DSAS, il faut aussi mettre à jour la machine de la 
build, et rebuild le DSAS de zéro avec les commandes

```
sudo tce-update
cd dsas-tinycore
./make.sh -realclean
./make.sh
``` 

dans le fichier `work/dsao.iso` un nouveau ISO du DSAS sera disponible. Après la
mise à jour d'un VM est la simple remplacement du ISO existant avec le nouveau ISO
comme

![Replacement du ISO pour un mise à jour sur VirtualBox](fr/vbox3.png)

## Mise à jour source

Si une vulnérabilité est identifiée sur une package du DSAS est une mise à jour
binaire n'est pas disponible, nous avons la possibilité de créer une package
pour le DSAS à partir du code source. Nous avons déjà plusieurs packages fait 
à partir du code source 

- `_pkg` [Requis] -  Le nom du package, ça doit être identique un nom du fichier  
moins l'extension `.pkg`
- `_version` [Optionnel] - Le numéro de version du logiciel
-`_uri` [Requis] - L'adresse auquel de chercher la source package du logiciel
- `_deps` [Optionnel] - Les dépendances nécessaire pour le logiciel tant qu'il 
est installé
- `_build_dep` [Optionnel] - Les dépendances nécessaire pendant la phase de build 
du logiciel
- `_pkg_path` [Optionnel] - Les packages source récupérée depuis `_uri` devrait 
être dans cette sous dossier. Si vide ou absent on assume que le build est à partir
du racine du package source. 
- `_conf_cmd` [Optionnel] - La commande nécessaire pour la configure du logiciel, 
typiquement `./configure`. La commande pourrait inclure des options si nécessaire 
pour la build comme `./configure --prefix=/usr/local`.
- `_make_cmd` [Optionnel] - La commande nécessaire afin de faire le build du logiciel,
typiquement `make`
- `_install_cmd` [Optionnel] - La commande nécessaire pour l'installation du logiciel. 
Il sera installé dans un dossier temporaire. Il est assumé que la commande 
`_install_cmd` accepte le nom du dossier temporaire en dernier argument. L'exemple 
typique de la commande `_install_cmd` est `make install DESTDIR=`
- `_pkgs` [Optionnel] - Le logiciel pourrait être splitté en plusieurs sous packages.
Cette variable permettre à définir la manière quel soit découpé. Un exemple pourrait
être `main{/usr/local/bin,/usr/local/lib};doc{/usr/local/share/doc}`. Le package 
principal est définit par `main{...}` et une deuxième package avec l'extension 
`-doc` sera créé avec les fichiers dans `/usr/local/doc`
- `_post_install` [Optionnel] - Permets de définir une script qui sera éxécuté 
pour l'installation du package.

Un exemple complet d'un fichier `pkg/openssl-1.1.1.pkg` est

```
_pkg=openssl-1.1.1
_version=1.1.1l
_uri=https://www.openssl.org/source/openssl-1.1.1l.tar.gz
_dep=""
_build_dep="compiletc perl5"
_pkg_path=openssl-1.1.1l
_conf_cmd="./config --openssldir=/usr/local/etc/ssl"
_make_cmd="make"
_install_cmd="make install DESTDIR="
_pkgs="main{/usr/local/bin,/usr/local/etc,/usr/local/lib/*.so*,/usr/local/lib/engines-1.1};dev{/usr/local/include,/usr/local/lib/*.a,/usr/local/lib/pkgconfig};doc{/usr/local/share}"
_post_install=\
'#! /bin/sh
[  -d /usr/local/etc/ssl/certs ] || mkdir -p /usr/local/etc/ssl/certs
[  -d /usr/local/etc/ssl/private ] || mkdir -p /usr/local/etc/ssl/private
[  -d /usr/local/etc/ssl/crl ] || mkdir -p /usr/local/etc/ssl/crl
[  -d /usr/local/etc/ssl/newcerts ] || mkdir -p /usr/local/etc/ssl/newcerts
[  -f /usr/local/etc/ssl/index.txt ] || touch /usr/local/etc/ssl/index.txt
[  -f /usr/local/etc/ssl/serial ] || echo "01" > /usr/local/etc/ssl/serial
[  -f /usr/local/etc/ssl/crlnumber ] || echo "01" > /usr/local/etc/ssl/crlnumber'
```

Avec cette package définit, il pourrait être créer avec la commande

```shell
./make.sh -build openssl-1.1.1
```

Un build du DSAS prendra en compte ce nouveau package pendant son build.

# Architecture détaillé

Cette section inclut des détails des mesures de sécurité mise en place afin
de garantir le niveau de sécurité du DSAS.

## Matrice de flux réseau détaillé

| Source          |  Destination    | Port        |  proto  | Service  | optionnel | commentaire                  |
|-----------------|-----------------|-------------|---------|----------|-----------|------------------------------|
| bas             | haut            | 22          | tcp     | ssh      | requis    | interconnexion machines dsas |
| réseau sensible | bas             | 5000        | tcp/udp | https    | requis    | console d'administration     |
| réseau sensible | bas             | 443         | tcp/udp | https    | optionnel | repositoire de fichier       |
| réseau sensible | bas             | 22          | tcp     | ssh      | optionnel | accès console user 'tc'      |
| réseau sensible | bas             | 22          | tcp     | sftp     | optionnel | accès fichiers user 'bas'    |
| réseau ouverte  | haut            | 22          | tcp     | sftp     | non reco. | dépôt fichier user 'haut'    |
| bas             | réseau sensible | 123         | udp     | ntp      | optionnel | synchronisation temps        |
| bas             | réseau sensible | 514         | udp     | syslog   | optionnel | service de log               | 
| haut            | réseau ouverte  | 22          | tcp     | sftp/scp |    -      | tâche en sftp/scp            |
| haut            | réseau ouverte  | 20          | tcp     | ftp      |    -      | tâche en ftp - data fixed    |
| haut            | réseau ouverte  | 21          | tcp     | ftp      |    -      | tâche en ftp                 |
| haut            | réseau ouverte  | 60000-65535 | tcp     | ftp      |    -      | tâche en ftp - data trigger  |
| haut            | réseau ouverte  | 80          | tcp/udp | http     |    -      | tâche en http                |
| haut            | réseau ouverte  | 443         | tcp/udp | https    |    -      | tâche en https               |

## Les comptes utilisateurs sur la DSAS

Il existe cinq comptes sur la DSAS, avec seulement un avec les droits de 
connexion avec un shell.

| compte | shell      | commentaire                                     |
|--------|------------|-------------------------------------------------|
| root   | /bin/false |                                                 |
| tc     | /bin/ash   | Seul utilisateur avec les droits de sudo        | 
| haut   | /bin/false | Utilisé pour connexion vers zone moins sensible |
| bas    | /bin/false | Utilisé pour connexion vers zone plus sensible  |
| verif  | /bin/false | Utilisé que à l'intérieur du DSAS               |

### Les droits d'écriture de chaque utilisateur

Les droits d’écriture de chacun des utilisateurs est comme selon le tableau ci-dessous

| compte | Dossier avec des droits d’écriture                    |
|--------|-------------------------------------------------------|
| tc     | /tmp, /var/*, /home/tc, /home/dsas/log, /dev, /mnt, /opt, /run |
| verif | /tmp, /home/verif, /home/dsas/haut, /home/dsas/bas, /home/dsas/log, /usr/local/var/lib/rpm  |
| haut  | /tmp, /home/haut, /home/dsas/haut |
| bas   | /tmp, /home/bas, /home/dsas/bas |

L’utilisateur `tc` a besoin d’accès a certains dossiers afin de faire opération d’administration. 
L’utilisateur `verif` a accès aux fichiers des utilisateurs `bas` et `haut` mais également pour l’écriture
des logs et à `/usr/local/var/lib/rpm` afin que l`utilisateur `verif` pourrait installer des certificats GPG 
pour `rpm` sans avoir les droits de `sudo`. Les certificats préexistant de rpm sont effacés à chaque
usage, et ce droit pour l’`utilisateur `verif` est sans risque.

## Cloisonnement disque 

Les fichiers téléchargés et vérifiés par le DSAS sont tous stocké sur un disque.
Ce disque est monté avec le flag "noexec" et aucun fichier téléchargé par le
DSAS sur ce disque pourrait être utilisé afin de compromettre l'intégrité du
DSAS.  Les utilisateurs "haut" et "bas" sont restrient à copier les fichiers seulement 
sur cette disque. L'ensemble des fichiers exécutable du DSAS sont sur un "ramdisk" 
en mémoire de la machine et copié depuis l'image ISO à chaque redémarrage.

Un hardlink sous linux est exactement le même fichier dupliqué à un autre endroit. 
L'usage des hardlink entre les fichiers du guichet haut du sas et le guichet bas 
pourrait permettre un simplification de l'architecture, car aucun moyen de tracer les
fichiers téléchargés sera nécessaire et ça sans augmentation de l'espace disque.

En revanche les hardlink doit respecter les exigences d'accès entre les guichets haut
et bas. Quand un fichier existe dans les deux zones, il faut que

- L'utilisateur haut ne peut pas modifier le fichier visible dans le guichet bas
- L'utilisateur haut ne peut pas supprimer l'existence du fichier dans le 
  guichet bas
- Que l'utilisateur haut pourrait supprimer l'existence du fichier dans le 
  guichet haut

Avec les permissions suivantes

| Perms      |  UID   | GID   |  Chemin
|------------|--------|-------|-------------------
| drwxrwx--- |  haut  | haut  |  dsas/haut
| -rw-r----- |  verif | share |  dsas/haut/fichier
| drwxrwx--- |  bas   | bas   |  dsas/bas
| -rw-r----- |  verif | share |  disas/bas/fichier

et un fichier /etc/group contenant 

```
verif:x:2000:
bas:x:2001:verif
haut:x:2002:verif
share:x:2003:verif,bas,haut
repo:x:2004:bas,tc
```

les exigences voulu sont respectés. Les scripts de vérification du DSAS ont été 
adapté afin d'assurer ces conditions

## Moyens de Vérification 

Il y a 3 types de vérification des dépôts linux

* rpm - La signature de chaque fichier RPM est vérifié avec "rpm -K"
* repomd - Le fichier repomd.xml est vérifié et seulement les haches de chaque fichier est vérifié
* deb - Le fichier Release est vérifié et seuelement les haches de chaque fichier est vérifié

Il y a cinq autres types de vérification 

* authenticode - Vérifier avec Microsoft Authenticode signatures. 
* liveupdate - Symantec LiveUpdate signatures
* cyberwatch - CyberWatch fichiers de signature
* gpg - Signature d'un fichier avec gpg
* openssl - Signature d'un fichier avec openssl

### Vérification - rpm

Dans les vérifications des dépôts RPM le fichier repodata/repomd.xml est lu et les fichiers
xml avec la liste des packages à vérifier sont lu. Tous les fichiers du dépôt sont listés
avec leur hache, dans le fichier dit "primaire" du dépôt. 

Un dépôt pourrait être le dépôt d'un OS comme par exemple 
[http://mirror.centos.org/centos/7/os/x86_64/](http://mirror.centos.org/centos/7/os/x86_64/)
ou d'autre dépôt comme par exemple
[http://mirror.centos.org/centos/7/extras/x86_64/](http://mirror.centos.org/centos/7/extras/x86_64/).

Dans la mode de vérification `rpm`, chaque fichier de package listé dans le fichier xml de dépôt
primaire est vérifié avec la commande `rpm -k` contre le certificat GPG fournit pour la tâche.

### Vérification - repomd

La mode `repomd` est comme la mode `rpm` avec l'exception que le fichier `repodata/repomd.xml` est
signé directement avec GPG. Le fait que ce fichier de métadonnées est signé et il contient la 
hache du fichier xml primaire, et les haches de chaque package est inclut dans le fichier xml de
dépôt primaire. De cette façon, une seule vérification de signature et des vérifications de
hash de chaque fichier de package, permets de cryptographiquement vérifier l'ensemble des fichiers
du dépôt. Ceci est plus rapide est aussi sûr que la vérification de type `rpm`.

### Vérification - authenticode

Pour le type de vérification "authenicode" chaque fichier dans le dossier est vérifiés contre les
certificats spécifiés. Si aucune autorité de certification est spécifiée, le store de certificat est
utilisé incluant tous les certificats dans le store. Ceci pourrait augmenter les risques et il est 
beaucoup mieux de spécifier un seul certificat autorité pour la vérification

Si les signatures sont valables et signées par les certificats spécifiés, les fichiers sont rendus 
disponible sur le sas du bas de DSAS. Aucun sous-dossier est traité

Le logiciel osslsigncode [https://github.com/mtrojnar/osslsigncode] est utilisé pour la vérification.
La commande

```shell
$ osslsigncode verify -CAfile ca.pem  <file>
```

est utilisé pour la vérification d'un fichier `<file>` contre un spécifique certificat racine `ca.pem`.
Si nous voulons vérifier contre un certificat intermédiaire, la commande est

```shell
$ osslsigncode verify -CAfile ca.pem -require-leaf-hash sha256:$(sha256sum inter.der | cut -d" " -f1) <file>
```

ou le fichier `inter.der` est la certificat intermédiaire à utiliser pour la vérification.

### Vérification - Symantec LiveUpdate

Les fichiers IntelligentUpdate de Symantec sont en authenticode, donc ils sont exclus de cette discussion.
Le format Symantec LiveUpdate est utilisé par `Symantec Endpoint Protection Manager` (SEPM) pour les mises
à jour. Le format de signature des fichiers de LiveUpdate sont très complexe avec des fichiers signés selon 
[la méthode détaillée dans la section suivante](#signature-des-fichiers-liveupdate), et des fichiers vérifiés
que par leurs hash dans un autre fichier signé, l'ensemble des fichiers en format LiveUpdate peut-être 
identifiés selon leurs nom comme

- `*.livetri.zip` - des fichiers signés de type LiveUpdate faisant références à d'autre fichiers non-signés
- `NNNNNNNNNN*.*` - des fichiers non-signés avec le champ `NNNNNNNNNN` représentant la date en nombre de secondes
depuis l'epoche Unix (1 janvier 1970, 00:00:00 UTC). Ces fichiers ne sont pas signés, et doit être référencés 
dans un fichier `*livtri.zip`. Ça semble que `SEPM` laisse des fichiers de ce type qui ne sont plus utilisé dans
un fichier `*livetri.zip` et dans ce cas les fichiers pourraient être ignorés.
- `minitri.flg` - Un fichier d’un seul octet avec le caractère `0x20` (un espace) dedans. La présence ou pas
du fichier pourrait modifier la comportement de `SEPM`. Le fichier ne pourrait pas être malveillante. Dans le
contexte de faire rentre des fichiers depuis un zone non sensible vers un zone sensible il ne pourrait pas 
être utilisé pour un canal cache pour la fuite d'information non plus. Ce fichier est transmis sans test
- `SymantecProductCatalog.zip` - les dates des fichiers dans cette archive sont tous avant 2009.  Mais la
date de l'archive est toujours mise à jour par `SEPM`, le fichier est signé est des vieux certificat de
Symantec. Ce fichier est vérifié est transmis par le DSAS
- `*.jdb`- [Les fichiers JDB sont pour des mise à jour de `SEPM` ou des clients 
`SEP`](https://knowledge.broadcom.com/external/article/151309/download-jdb-files-to-update-definitions.html). 
A ce jour ils sont signés avec un certificat Symantec périmé. 

Le DSAS est capable de transmettre l'ensemble de ce type de fichiers avec l'exception des fichiers
`NNNNNNNNNN*.*` qui ne sont plus listé dans un fichier `*livetri.zip`.

#### Signature des fichiers LiveUpdate

Les fichiers de LiveUpdate, et les fichier JDB, de Symantec ne sont pas signés directement. En revanche 
l'ensemble de ces fichiers sont des archives en format `7z` ou `ZIP`, et ces archives contient deux fichiers,
typiquement nommés `v.grd` et `v.sig`. Ces fichiers pourraient avoir d'autre nom, mais les extensions
`.grd` et `.sig` sont toujours utilisés

Le contenu de la fichier `.grd` est en format comme

```
[GuardHeader]
Legal=Copyright (c) 2021 Broadcom. All Rights Reserved.
LastModifiedUtcSeconds=1631691252
LastModifiedGmtFormated=20210915 07:34:12
[File-catalog.dat]
SHA1=283a3db5efa98bca72c9a637d06ee91e0602bd78
SHA256=aba60a13486e25fe4cb4faf332ff304159d9611433618f1d067e756746432918
[File-cceraser.dll]
SHA1=4454574388758ec3d0cad00b142df6a163a5c001
SHA256=721473abd9d240d5170c9952a8a1d1644f177c1dbbef01b105e1d44705188db4
...
```

Avec des haches de l'ensemble des fichiers contenu dans l'archive. Dans le cas des fichiers `*livetri.zip`
les haches des fichiers pourraient correspondre également à un autre fichiers pas inclut directement dans
l'archive mais à côté avec un nom comme `NNNNNNNNNN*.*`. La commande

```shell
$ openssl asn1parse -i -inform der -in v.sig
```

permettre de voir facilement que la fichier `.sig` contient, au moins deux certificats,
une hache de la fichier `.grd` et la signature en binaire lui-même. La texte "pkcs7-signedData"
permettre d'identifier le type de signature utilisé. Le problème est que la chaine de 
confiance des fichiers `.sig` sont typiquement

```
Symantec Internal RSA IT Root
-> Symantec Code Signing 2017 CA
  -> Product Group - LiveUpdate
```

ou

```
Symantec Root 2005 CA
-> Code Signing 2005 CA
  -> Symantec Corporation
```

ou bien

```
Symantec Root CA
-> Code Signing CA
  -> Symantec Corporation
```

pour des vielles fichiers. Aucun de ces certificats est publiquement disponible, est ils sont 
embarquées directement dans le logiciel SEPM à son installation. La chaine des certificats 
utilisés sont inclut dans les fichiers `.sig` et nous pourrions les sortir en format PEM avec une 
commande

```shell
$ openssl pkcs7 -inform der -in v.sig -outform pem -print_certs | awk 'split_after==1{n++;split_after=0} /-----END CERTIFICATE-----/ {split_after=1}{if(length($0) > 0) print > "cert" n ".pem"}
```

cette commande va créer deux fichier, `cert.pem` et `cert1.pem` avec la certificat signataire et les 
certificats intermédiaires utilisés. Ces certificats peuvent être importé dans le DSAS. Malheureusement, 
ceci va permettre de sortir que les certificats intermédiaires et la certificat utilisé pour la signature. 
La certificat racine n'est pas inclut dans les fichiers de signature. Il faut retourner vers l'exécutable de SEP 
afin de retrouver les trois certificats racines utilisées par SEPM. 

Tous les postes clients 64bit de SEP inclut l'exécutable `sepWscSvc64.exe`. En regardant avec la commande

```shell
$ LANG=C grep -obUaP "\x30\x82..\x30\x82" sepWscSvc64.exe
```

ou si ta version de grep inclut pas de regexp de type perl 

```shell
$ echo -e "\x30\x82..\x30\x82" | LANG=C xargs -i grep -obUa {} sepWscSvc64.exe
``` 

c'est possible d'identifier la début des certificats. Le texte "\x30\x82" correspond à la code ASN.1
pour une `SEQUENCE`. Une séquence est toujours suivi par une longueur codé sur deux octets, et un 
certificat démarre toujours avec deux `SEQUENCE`. Donc le regexp "\x30\x82..\x30\x82" est adapté à
trouver les débuts des certificats, mais pas que.  Cette commande trouver les offsets binaires des
endroit correspondant à des certificats comme

```
$ echo -e "\x30\x82..\x30\x82" | LANG=C xargs -i grep -obUa {} sepWscSvc64.exe
1665104:0▒▒0▒
1666048:0▒▒0▒
1667008:0▒▒0▒
1794627:0▒)▒0▒
1805383:0▒0▒
1806692:0▒▒0▒
1809680:0▒j0▒
1810300:0▒▒0▒
1811326:0▒▒0▒
1811999:0▒▒0▒
1814423:0▒▒0▒
1815659:0▒Y0▒
1817874:0▒j0▒
1818494:0▒▒0▒
1819520:0▒▒0▒
1820193:0▒▒0▒
```

mais le texte du regexp pourrait également être une partie du binaire et pas un certificat de tout. 
Il faut les tester tous ces valeurs avec

```shell
$ dd bs=1666048 skip=1 if=sepWscSVC64.exe | openssl -inform der -in - -noout -text | less
```

et quand les certificats `Symantec Internal RSA IT Root`, `Symantec Root 2005 CA` et `Symantec Root CA` sont identifiés, les sauver avec

```shell
$ dd bs=1665104 skip=1 if=sepWscSvc64.exe | openssl x509 -inform der -in - -outform pem -out Symantec_Internal_RSA_IT_ROOT.pem
$ dd bs=1666048 skip=1 if=sepWscSvc64.exe | openssl x509 -inform der -in - -outform pem -out Symantec_Root_2005_CA.pem
$ dd bs=1667008 skip=1 if=sepWscSvc64.exe | openssl x509 -inform der -in - -outform pem -out Symantec_Root_CA.pem
```

Maintenant le format `PKCS7` est le format utilisé par `SMIME`, et ici la signature est en 
format `DER`. La commande normale de vérification de signature `SMIME` est

```shell
$ openssl cms -verify -inform der -in v.sig -content v.grd
```

cette commande va vérifier les signatures contenu dans `v.sig' contre les certificats racines 
installé sur la machine et comparer contre le hache du fichier `v.grd`. Le certificat racine 
typiquement utilisé est `Symantec Root 2005 CA`, et donc le vrai vérification à mettre en place 
est 

```shell
$ openssl cms -verify -CAfile SymantecRoot2005CA.pem -inform der -in v.sig -content v.grd
```

qu'on va trouver deux autres problème avec les chaines de signature de Symantec. Deux des trois certificats
racines utilisés par Symantec pour les signatures ont expiré, et Symantec n'ont pas utilisé
des signatures horodaté avec un server de temps openssl. Donc, òpenssl` va réfuser de valider les fichiers
fournis par Symantec. Le deuxième problème est dans les champs `X509v3 Key Usage` et `X509v3 Extended
Key Usage`. `openssl` demande que l'ensemble des certificats de la chaine de confiance support les mêmes
options de signature, mais le certificat `Code Signing CA` support l'option `Code Signing', mais les
deux autres certificats dans la chaine ne le supportent pas. Deux autres options de `openssl` sont
nécessaire afin de détourner ces problèmes, comme

```shell
$ openssl cms -verify -purpose any -no_check_time -CAfile SymantecRoot2005CA.pem -inform der -in v.sig -content v.grd
```

Ceci suffit afin de vérifier que les fichiers de Symantec sont bien signés par un certificat avec la
racine `Symantec Root 2005 CA`, mais rien veut dire Symantec n'as pas autorisé un autre certificat 
intermédiate sur cette racine. Donc ça sera plus propre de vérifier la signature contre une chaine
de confiance complète que nous contrôle. Pour ça le DSAS nous doit ignorer les certificats dans 
`v.sig` en prenant en compte que les données de signature, et nous sommes obligé à fournir les deux
autres certificats utilisés pour les signatures, `cert.pem` et `cert1.pem` créé ci-dessus. L'argument
`-certfile` pourrait être utilisé afin de faire, mais `openssl` n'accepte qu’un seul argument de 
type `-certfile`, donc les deux certificats doit être remise dans un seul fichier et vérifier comme

```shell
$ cat cert.pem cert1.pem > certs.pem
$ openssl cms -verify -CAfile SymantecRoot2005CA.pem -certfile certs.pem -nointern -inform der -in v.sig -content v.grd
```

### Vérification - debian

La base de la verification des dépôt debian est la fichier `Release` et sa signature `Release.gpg`.
Depuis peu, il y a egalement un fichier `InRelease` qui est identique au fichier `Release` mais avec
la signature `gpg` integrée.

Les dépôt debian sont signés avec plusieurs clefs. Actuellement, a chaque nouvelle version de debian
un clef d'archive maitre est renouvellé. Le fichier `Release` est signé avec la clef maitre courant 
et la clef antecedante. Les dépots `stable`, `testing`, `security` ne sont signés que avec ces deux 
clefs. En revanche les dépôts des version eux-même tel-que `Buster`ou `BullsEye` sont egalement signés
avec une troisème clef lié a ce version.

La vérification des dépôt debian requiert que l'ensemble de ces clefs que disponible pour les taches.
Par exemple pour `BullsEye` les clefs nécessaire sont

- [Debian 10/buster archive signing key](https://ftp-master.debian.org/keys/archive-key-10.asc)
- [Debian 11/bullseye archive signing key](https://ftp-master.debian.org/keys/archive-key-11.asc)
- [Debian 11/bullseye release key](https://ftp-master.debian.org/keys/release-11.asc)

### Vérification - gpg

Les signatures GPG pourrait être intégré dans le fichier signé ou dans un fichier à part. Le DSAS
assume qu'un des moyens suivant est utilisé afin de signé un fichier

```shell
$ gpg --output <file>.gpg --sign <file>
$ gpg --output <file>.sig --detach-sig <file>
$ gpg --output <file>.sig -a --detach-sig <file>
```

Donc des signature détaché sont en deux fichiers <file> et <file>.sig, et des signature intégrés 
sont dans des fichiers terminant comme <file>.gpg. Le DSAS traite les deux types de signature. Dans le
cas de signature détaché, les deux fichiers doit être fournis au DSAS.

### Vérification - openssl

L'utilisateur doit avoir déjà généré des clefs publiques et privés pour la signature avec 

```shell
$ openssl genrsa -out key.pem 4096
$ openssl rsa -in key.pem -pubout > key.pub
```

Et la clef publique dans le fichier key.pub doit être associé avec la tâche dans le DSAS. Les fichiers
sont signés comme

```shell
$ openssl dgst -sign key.pem -keyform PEM -sha256 -out <file>.sig -binary <file>
```

Les signatures sont toujours stockées dans des fichiers séparés, et le DSAS assume que les signatures
sont dans un fichier avec un extension .sig. Les deux fichiers doivent être fournis au DSAS.

### Cas special - fichier zip non signé

Dans la cas des tâches __liveupdate__ et __cyberwatch__ les fichiers signé sont contenu dans un fichier
zip non signé. Le probleme avec cette situation est que même si l'ensemble des fichiers dans le fichier
zip sont signé, le zip peuvent caché d'autre données n'appartentient pas au fichier zip. Ceci est 
voulu dans le désign des fichiers zip afin de permettre la création d'autre format de zip, comme les 
fichiers __JAR__, mais egalement afin d'inclure des zip dans des executable (des zips auto-extractant).
Il y a également des façon d'abuser le format des fichiers zip afin de cacher des données.

Un fichier zip est compris de __N__ objets compressé suivi par une index des fichiers contenu dans le 
zip avec les positionnes pour chaque objet compressé du fichier zip relatives aux positionne de l'index.
Ceci ouvre 4 endroit possible à cacher des données dans une fichier zip

- ajouter au début : parce que les postionnes des objets compressé sont rélative à l'index il est tout
à fait possible d'avoir des données avant ces objets
- ajouter à la fin : de même façon des données pourrait être caché après l'index du fichier zip
- intercaler entre les objets compressé : Les objets non pas besoin d'occupé tout espaces du fichiers, il
suffit simplement que les positionnes dans l'index soit correcte
- Dans le zone de commentaire de l'index : le format zip permets jusqu'au 65536 caracteres dans le zone
de commentaire de l'index lui-même.

En utilisant le fichier zip aucun de ces zones sera regarder. Mais si on laisse passer le fichier zip
quelqu'un dans le zone sensible pourrait abuser de cette comportement afin de faire passer des fichiers
non vérifier à traverse du DSAS.

Ceci ne concerne que des fichiers zip non signé, car quelqu'un capable de signer le zip est egalement
capable de signer le contenu. Donc la parade est relativement simple, et consist à reconstruire les 
fichiers zip non signé à partir de son contenu. Le DSAS implemente cette parade

## Service OpenSSH

L'ensemble des flux ssh possible est

| Source          |  Destination    | Utilisateur | Service  | Optionnel | 
|-----------------|-----------------|-------------|----------|-----------|
| réseau sensible | bas             | tc          | ssh      | optionnel |
| réseau sensible | bas             | bas         | sftp     | optionnel |
| bas             | haut            | tc          | ssh      | requis    |
| bas             | haut            | bas         | sftp     | requis    |
| réseau ouverte  | haut            | haut        | sftp     | non reco. |

ou les service `ssh` correspond à l'ensemble des services de ssh (ssh, scp et sftp). Le
premier option de durcissement des service sshd, sauf en cas de la présence de la flux
non recommandé depuis le réseau ouverte, les service n'écoute que les flux d’origine d'un 
réseau plus sensible avec l'option de configuration `Listen` d'OpenSSH. Après par défaut
l'accès est interdit à l'ensemble dès l'utilisateur et les permissions de chaque utilisateur
permis est explicitement ajouté. La configuration pour les utilisateurs `tc` sont de la
forme

```

Match User tc Address $USER_TC
	PasswordAuthentication yes
	PubkeyAuthentication yes
```

ou `$USER_TC` est une liste d'adresse IP ou CIDR permis à connecter au serveur. Afin de 
bien sécurisé cette liste devrait être limité. Pour les autres utilisateur la configuration
de sshd est

```
Match User $TYP Address $USER
	PasswordAuthentication yes
	PubkeyAuthentication yes
	ChrootDirectory /home/dsas/$TYP
	X11Forwarding no
	AllowTcpForwarding no
	AllowAgentForwarding no
	ForceCommand internal-sftp -u 0007 -d /share
```

les utilisateurs en `sftp` sont limité strictement a ou ils sont accès est le `forwarding`
est interdit. Le `umask` par défaut est forcé d'être 007 afin d'assure un accès aux fichiers
à l'utilisateur `verif`.

## Service web

Il y a deux service web; un requis pour l'administration du DSAS et un deuxième optionnel
pour un dépôt des fichiers. Les deux sites partagent le certificat TLS, qui sont 
stocké dans `/var/dsas/`. Les permissions du certificat privé sont alors (0640), avec une
groupe `repo` auquel appartiennent les deux utilisateurs `tc` et `bas`.

Le serveur d'administration est exécuté en tant qu'utilisateur `tc` est ne peux accéder
que des fichiers accessible à l'utilisateur `tc`. Le site est disponible seulement en https 
sur la port `5000`. Le site est écrit en `HTML5, JS et bootstrap5` pour le frontend et `PHP8` 
pour le backend.  L’authentification sur le site est faite avec le connecteur `SASL` aux comptes 
local à la machine `bas`. `SASL` est configuré de fonctionner qu’avec des `Unix domain socket` 
complétement local à la machine, donc accessible que au processus tournant sur la machine.
Le backend retourne une session identifiant pour un login réussite. Cet identifiant est
vérifié a chaque opération sur le backend, et périmé après dix minutes sans accès à la 
machine.

Le politique du backend est qu’aucune information venant du frontend est considéré comme 
sûr est tout est vérifié. La fonctionne `proc_open` de `PHP8` est utilisé pour des 
commande système nécessaire à l'administration, et

- Appelé d'une façon à ne pas démarrer un shell
- Avec tout argument vérifié est échappé afin d'éviter l'injection de commande

Le site de dépôt optionnel est exécuté en tant que l'utilisateur `bas` et ne peut
accéder que des fichiers disponible pour l'utilisateur `bas`. Cette liste de fichiers est
très limité est inclut en gros que des fichiers préinstallé ou vérifié par le DSAS. Le site 
est disponible seulement en https sur la port `443`. Les utilisateurs du dépôt n’ont que le droit
de télécharger des fichiers et en aucun cas, ils auraient le droit d’ajouter des fichiers au dépôt.

