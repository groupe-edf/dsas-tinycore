## /api/V2/apply
- Method : GET
- Param : None
- Response :
  * 200 Success
  - 500 Internal server error
- Return : 
  * Success : array{retval: int, output: string}
  * Failure : None

## /api/v2/backup
- Method : POST
- Param : 
  * passwd : A string representing the password to use to encrypt the backup. Can be empty
  * FILES file : The backup file to restore
- Response : 
  * 200 Success
- Return :
  * Success : array{retval: int, stdout: string, stderr: string}
  * Failure : array{restore: string}

## /api/v2/backup
- Method : GET
- Param : 
  * passwd : A string representing the password to use to encrypt the backup. Can be empty
- Response : 
  * 200 Success
  * 500 Internal Server Error
- Return :
  * Success : array{file: string}
    Base64 encode backup file
  * Failure : None

## /api/v2/cert/<fingerprint>
- Method : DELETE
- Param : 
- Response :
  * 200 Success
- Return :
  * Success : array{retval: int}
  * Failure : array<string, string>

## /api/v2/cert/drag
- Method : POST
- Param :
  * from : int
  * to : int
- Response :
  * 200 Success
- Return :
  * Success : array{retval: int}
  * Failure : array<string, string>

## /api/v2/cert/gpg
- Method : POST
- Param :
  * FILES file : GPG certificate in pem format
- Response :
  * 200 Success
- Return :
  * Success : array{retval: int}
  * Failure : array<string, string>

## /api/v2/cert/pubkey
- Method : POST
- Param :
  * FILES file : SSL public key in pem format
- Response :
  * 200 Success
- Return :
  * Success : array{retval: int}
  * Failure : array<string, string>

## /api/v2/cert/x509
- Method : POST
- Param :
  * FILES file : X509 certificate in pem format
- Response :
  * 200 Success
- Return :
  * Success : array{retval: int}
  * Failure : array<string, string>

## /api/v2/cert
- Method : GET
- Param : 
- Response :
  * 200 Success
  * 500 Internal Server ERror
- Return :
  * Success : array{dsas: array{x509: mixed, pubkey: mixed, gpg: mixed}, ca: mixed}*

## /api/v2/logout
- Method : GET
- Param : None
Response : 
  * 200 Success
- Return
  * array{retval: int}
  
## /api/v2/logs
- Method : GET
- Param :
  * REFRESH_LEN (Optional)
- Response :
  * 200 Success
- Return :
  * array{0: string, 1: string, ... N: string}
  
## /api/v2/net
- Method : POST
- Param: 
  * data : array{bas: array{dhcp: string, cidr: string, gateway: string, 
                             dns: array{domain: string, nameserver: string[]}},
                 haut: array{dhcp: string, cidr: string, gateway: string, 
                             dns: array{domain: string, nameserver: string[]}}}
- Response :
  * 200 Success
- Return :
  * Success : array{retval: int}
  * Failure : array<string, string>
  
## /api/v2/net
- Method : Get
- Param : None
- Response :
  * 200 Success
  * 500 Internal Server Error
- Return :
  * Success : array{bas: array{dhcp: string, cidr: string, gateway: string, 
                                dns: array{domain: string, nameserver: string[]}},
                    haut: array{dhcp: string, cidr: string, gateway: string, 
                                dns: array{domain: string, nameserver: string[]}}}
  * Failure: None
  
# /api/v2/passwd
- Method : POST
- Param : 
  * data : array{username: string, passwd: string}
- Response:
  * 200 Success
- Return :
  * Success : array{retval: int}
  * Failure : array<string, string>

## /api/v2/passwd
- Method : GET
- Param : None
- Response :
  * 200 Success
- Return :
  * array{username: string, type: string}

## /api/v2/reboot
- Method : GET
- Param : None
- Response :
  * 200 Success
  * 500 Internal Server Error
- Return :
  * Success : array{retval: int, stdout: string, stderr: string}
  * Failure : None
  
## /api/v2/save
- Method : GET
- Param : None
- Response :
  * 200 Success
  * 500 Internal Server Error
- Return :
  * Success : array{stdout: string, stderr: string}
  * Failure : None

## /api/v2/service
- Method : GET
- Param : None
- Response :
  * 200 Success
  * 500 Internal Server Error
- Return :
  * Success : array{stdout: string, stderr: string}
  * Failure : None
  
## /api/v2/service
- Method : POST
- Param : 
  * data : array{ssh: array{active: string, user_tc: string, 
                      user_bas: string, user_haut: string},
                      radius: array{active: string, server: string, secret: string, domain: string},
                      syslog: array{active: string, server: string},
                      ntp: array{active: string, server: array{string}},
                      antivirus: array{active: string, uri: string},
                      web: array{repo: string},
                      snmp: array{active: string, username: string, password: string,
                                   encrypt: string, passpriv: string, 
                                   privencrypt: string}}
- Response :
  * 200 Success
  * 500 Internal Server Error
- Return :
  * Success : array{stdout: string, stderr: string}
  * Failure : None
  
## /api/v2/shutdown
- Method : GET
- Param : None
- Response :
  * 200 Success
  * 500 Internal Server Error
- Return :
  * Success : array{retval: int, stdout: string, stderr: string}
  * Failure : None

## /api/v2/status
- Method : GET
- Param : None
- Response :
  * 200 Success
- Return :
  * array{bas: array<string, mixed>, haut: array<string, mixed>}

## /api/v2/users
- Method : GET
- Param : None
- Response :
  * 200 Success
  * 500 Internal Server Error
- Return :
  * Success : array{hash; string, array<string, array{username: string, type: string, desription: string, active: bool}>}
  * Failure: None

## /api/v2/users/add/<string>
- Method : POST
- Param : None
- Response :
  * 200 Success
- Return :
  * Success : array{retval: int}
  * Failure : array<string, string>

## /api/v2/users/drag/<string>
- Method : POST
- Param :
  * to : int
- Response :
  * 200 Success
- Return :
  * Success : array{retval: int}
  * Failure : array<string, string>
  
## /api/v2/users/<string>
- Method : DELETE
- Param : None
- Response :
  * 200 Success
- Return :
  * Success : array{retval: int}
  * Failure : array<string, string>

## /api/v2/users/modify
- Method : POST
- Param :
  * data : array{username: string, passwd: string, description: string, type: string, active: string}
- Response :
  * 200 Success
- Return :
  * Success : array{retval: int}
  * Failure : array<string, string>

## /api/v2/users/passwd/<string>
- Method : POST
- Param :
  * passwd : string
- Response :
  * 200 Success
- Return :
  * Success : array{retval: int}
  * Failure : array<string, string>

## /api/v2/warning
- Method : GET
- Param : None
- Response :
  * 200 Success
- Return :
  * array{type: string, msg: string}

## /api/v2/web
- Method : GET
- Param : None
- Response :
  * 200 Success
  * 500 Internal Server Error
- Return
  * array{ssl: array<string, string>, repo: string}

## /api/v2/web/upload
- Method : POST
- Param :
  * FILES file
- Response :
  * 200 Success
- Return :
  * Success : array{retval: int}
  * Failure : array<string, string>

## /api/v2/web/renew
- Method : POST
- Param : 
  * countryName : string
  * stateOrProvinceName : string
  * localityName : string
  * organizationName : string
  * organizationalUnitName : string
  * commonName : string
  * emailAddress : string
  * validity : string
- Response :
  * 200 Success
- Return :
  * Success : array{retval: int}
  * Failure : array<string, string>






  
