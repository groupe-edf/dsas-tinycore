# DSAS - Sas de docontamination
## Introduction

A faire

## Usage des hardlink linux

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


# Taches

## Verification 

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

A faire




