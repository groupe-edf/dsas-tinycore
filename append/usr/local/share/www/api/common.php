<?php
/**
 *    DSAS - Tinycore
 *    Copyright (C) 2021-2022  Electricite de France
 *
 *    This program is free software; you can redistribute it and/or modify
 *    it under the terms of the GNU General Public License as published by
 *    the Free Software Foundation; either version 2 of the License, or
 *    (at your option) any later version.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU General Public License for more details.
 *
 *    You should have received a copy of the GNU General Public License along
 *    with this program; if not, write to the Free Software Foundation, Inc.,
 *    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */

define("_DSAS_HOME", "/home/dsas");
define("_DSAS_HAUT", _DSAS_HOME . "/haut/share");
define("_DSAS_BAS", _DSAS_HOME . "/bas/share");
define("_DSAS_VAR", "/var/dsas");
define("_DSAS_LOG", _DSAS_HOME . "/log");
define("_DSAS_XML", _DSAS_VAR . "/dsas_conf.xml");

/**
 * Returns a string with the path to the a certificate bundle on the machine
 *
 * @return string
 *     A string with the the absolute path of the CA certificate bundle
 */
function dsas_ca_file() : string {
  foreach (["/etc/ssl/ca-bundle.crt", "/etc/ssl/ca-certificates.crt",
           "/usr/local/etc/ssl/ca-bundle.crt", "/usr/local/etc/ssl/ca-certificates.crt"] as $f) {
    if (is_file($f))
      return $f;
  }
  return "";
}

/**
 * Returns true if an active session exists for the requested user. If the current
 * time is more than 10 minutes since the last call to this function. The user is
 * automatically logged out
 *
 * @param bool $update_timeout
 *     If false the call to this function does not update the inactivity counter. This
 *     allows testing if the user is logged in from status updates, etc
 * @param bool $admin_only
 *     If true, this function will always return false for non administrator uses
 * @return bool
 *     Returns true if a current session is active and last activity was less than 10
 *     minutes ago
 */
function dsas_loggedin(bool $update_timeout = true, bool $admin_only = true) : bool {
  // Initialize the session, ignoring uninitalised session ids
  ini_set("session.use_strict_mode", "1");
  session_set_cookie_params(["secure" => true,
                             "httponly" => true,
                             "samesite" => "strict"]);
  session_start();

  // Check if the user is already logged in
  if(!isset($_SESSION["loggedin"]) || $_SESSION["loggedin"] !== true){
    return false;
  }

  // Check for autologout after 600 seconds
  if(time() - $_SESSION["timestamp"] > 600){
    $_SESSION = array();
    session_destroy();
    return false;
  } else if ($update_timeout) {
    $_SESSION["timestamp"] = time();
  }

  if ($admin_only) {
    if (dsas_is_admin())
      return true;
    else
      return false;
  } else
    return true;
}

/**
 * Return true is the user of the current session is an administrator
 *
 * @return bool
 */
function dsas_is_admin() : bool {
  $dsas = simplexml_load_file(_DSAS_XML);
  if ($dsas === false)
     return false;
  foreach ($dsas->config->users->user as $user) {
    if ($user->username == $_SESSION["username"]) {
      if ($user->type == "admin")
        return true;
      else
        return false;
    }
  }
  return false;
}

/**
 * Return true is the user requested is marked as active
 *
 * @param string $user
 *     A string that might contain ther username of a user in the XML configuration file
 * @return bool
 *     Returns true if the user is both in the XML both and marked as active
 */
function dsas_user_active(string $user) : bool {
  $dsas = simplexml_load_file(_DSAS_XML);
  if ($dsas === false)
    return false;
  foreach ($dsas->config->users->user as $duser) {
    if ($duser->username == $user) {
      if ($duser->active == "true")
        return true;
      else
        return false;
    }
  }
  return false;
}

/**
 * A wrapper around proc_open to allow the control of linux procesus to the local
 * machine. It should have arguments passed as an array to prevent the process
 * spawning a shell that might be attacked
 *
 * @param array<string>|string $args list of arguments to pass to proc_open
 * @param string $cwd Current working directory
 * @param array<string> $stdin An array of strings representing line by line the input
 * @return array{retval: int, stdout: string, stderr: string} 
 */
function dsas_exec(mixed $args, string $cwd = null, array $stdin = []) : array {
  // Simplify the call to proc_open with the means to avoids spawning a shell
  // and escaping the args integrated. The args MUST be passed as an array to get
  // the escaping to work properly.

  $descriptorspec = array(
    0 => array("pipe", "r"), // stdin
    1 => array("pipe", "w"), // stdout
    2 => array("pipe", "w") //stderr
  );

  // Call command as an array to avoid creating a shell
  $process = proc_open($args, $descriptorspec, $pipes, $cwd);
  if (is_resource($process)) {
    // Make the output pipes non-blocking so we can just read them 
    // after all of the inputs are done
    stream_set_blocking($pipes[1], false);
    stream_set_blocking($pipes[2], false);

    // Write all of the inputs line by line. Need to parse user
    // input before using them in this function !!!
    // FIXME IF this blocks, we'll need to intercale the writes
    // to stdin with the reads from stdout and stderr below
    foreach ($stdin as $line)
       fwrite($pipes[0], $line . PHP_EOL);
    fclose($pipes[0]);

    // Intercale reading of stderr and stdout to avoid one blocking the other
    $stdout="";
    $read_out=true;
    $stderr="";
    $read_err=true;
    $len = 0;
    while ($read_out || $read_err) {
      if ($read_out) {
        if (! $pipes[1] || feof($pipes[1])) {
          fclose($pipes[1]);
          $read_out = false;
        } else if ($str = fgets($pipes[1])) {
          $stdout = $stdout . $str;
          $len = strlen($str);
        }
      }
      if ($read_err) {
        if (feof($pipes[2])) {
          fclose($pipes[2]);
          $read_err = false;
        } else {
          $str = fgets($pipes[2]);
          $stderr = $stderr . $str;
          if ($len == 0 && $str !== false)
            $len = strlen($str);
        }
      }
      if ($len == 0)
        usleep(10000);
      else
        $len = 0;
    }
    $retval = proc_close($process);
    return ["retval" => $retval, "stdout" => $stdout, "stderr" => $stderr];
  } else {
    return ["retval" => -1, "stdout" => "", "stderr" => ""];    
  }
}

/**
 * Wrapper around the real function to test the user password. Now just simplified to use PAM
 *
 * @param string $user
 *     The username to test
 * @param string $pass
 *     The password to test
 * @return bool
 *     Returns true if user and password are valid. Waiting 3 seconds to return false otherwise
 */
function dsas_checkpass(string $user, string $pass) : bool {
    $error=""; // Keep phpstan happy
    if (pam_auth($user, $pass, $error, false, "php"))
      return true;
    else
      return false;
}

/**
 * A function to impose password complexity rules
 *
 * @param string $passwd
 *     The password to have its complexity tested
 * @return bool
 *     Returns true if password is of valid complexity
 */
function complexity_test(string $passwd) : bool {
   // Passwords must be at least 8 characters long and contain at least 3 of LUDS
   if (strlen($passwd) < 8)
      return false;
   // Don't allow spaces in passwords
   if (preg_match("/\\s/", $passwd))
     return false;
   // See https://owasp.org/www-community/password-special-characters
   // Don't permit the characters "'` or spaces because however
   $luds = 0;
   if (preg_match("/[a-z]/", $passwd))
     $luds += 1; 
   if (preg_match("/[A-Z]/", $passwd))
     $luds += 1;
   if (preg_match("/[0-9]/", $passwd))
     $luds += 1;   
   if (preg_match("/[!#$%&\(\)*+,-.\/:;<=>?@\[\\\]^_\{|\}~]/", $passwd))
     $luds += 1;
   if ($luds < 3)
     return false;
   return true;
}

/**
 * Return a string that can be used as the address of the upper machine.
 * This should be the hostname listed in /etc/host
 *
 * @return string
 */
function interco_haut() : string {
  return "haut";
}

/**
 * A function to test whether a password change should be forced. This allows the default
 * password to be forced to be changed
 *
 * @return bool
 *     Returns true if the user must change their password
 */
function force_passwd() : bool {
  $dsas = simplexml_load_file(_DSAS_XML);
  if ($dsas !== false && $dsas->config->users->first == 'true')
    return true;
  return false;
}

/**
 * Function to change a users password. Users are controlled as local linux users
 *
 * @param string $name
 *     The username to have their password changes
 * @param string $passwd
 *     The password to change to
 * @param string $hash
 *     The hash type to be used. By default 'sha512'
 * @return array{retval: int, stdout: string, stderr: string}
 *     A keyed array containg the output of the attempted password change. 'retval' is zero if
 *     sucessful 
 */
function change_passwd(string $name, string $passwd, string $hash = "sha512") : array {
 // Remove all white space to avoid RCE. Space illegal in username and password
 $name=preg_replace("/\s+/", "", $name);
 $passwd=str_replace("/\s+/", "", $passwd);

  $descriptorspec = array(
    0 => array("pipe", "r"), // stdin
    1 => array("pipe", "w"), // stdout
    2 => array("pipe", "w") //stderr
  );
  $cwd="/tmp";
  
  // Only change password on machine haut if the user is "tc". The only users aren't
  // installed on the machine haut. Use proc_open with a command array to avoid spawning 
  // a shell that can be attacked. Set the machine "haut" first as it might not be available
  if ($name == "tc") {
    $process = proc_open(["ssh", "tc@" . interco_haut(), "sudo", "/usr/sbin/chpasswd", "-c", $hash], $descriptorspec, $pipes, $cwd);
    if ($process === false || $pipes[0] === false)
      return ["retval" => 1, "stdout" => "", "stderr" => "can not change password"];

    // password and username can't be used to attack here as
    // there is no shell to attack. At this point its also too late
    // to pass args to chpasswd like "-c md5" to force a weak hash
    // So this is safe. 
    fwrite($pipes[0], $name . ":" . $passwd . PHP_EOL);
    fclose($pipes[0]);
    fclose($pipes[1]);
    $stderr = (string)fgets($pipes[2]);
    fclose($pipes[2]);
    $retval = proc_close($process); 
    if ($retval != 0)
      return ["retval" => $retval, "stdout" => "", "stderr" => $stderr];
  }

  // Now set the password on the machine "bas"
  $process = proc_open(["sudo", "/usr/sbin/chpasswd", "-c", $hash], $descriptorspec, $pipes, $cwd);
  if ($process === false || $pipes[0] === false)
    return ["retval" => 1, "stdout" => "", "stderr" => "can not change password"];
  
  fwrite($pipes[0], $name . ":" . $passwd . PHP_EOL);
  fclose($pipes[0]);
  fclose($pipes[1]);
  $stderr = (string)fgets($pipes[2]);
  fclose($pipes[2]);
  $retval = proc_close($process);
  return ["retval" => $retval, "stdout" => "", "stderr" => $stderr];
}

/**
 * Converts a IPv4 mask like '255.255.255.0' into CIDR format, like '24'. This function
 * does no error checking and it is assuming the mask is already tested as valid
 *
 * @param string $mask
 *     The mask to convert to CIDR format
 * @return string
 *     The mask in CIDR format 
 */
function mask2cidr(string $mask) : string {
  $long = ip2long($mask);
  $base = ip2long("255.255.255.255");
  return (string)(32-log(($long ^$base)+1,2));
}

/**
 * Returns the IP address and mask in CIDR format of a given interface
 *
 * @param string $interface
 *     A valid interface on the local machine. For example 'eth0'
 * @return string
 *     The ip address of the interface and its mask in CIDR format
 */
function ip_interface(string $interface) : string{  
  $pattern1 = "/inet addr:(\d+\.\d+\.\d+\.\d+)/";
  $pattern2 = "/Mask:(\d+\.\d+\.\d+\.\d+)/";
  $output = dsas_exec(["/sbin/ifconfig", $interface]);      
  if ($output["retval"] === 0) {
    $text = $output["stdout"];
    if (! is_string($text))
      $text = implode(" ", $text);                                                
    preg_match($pattern1, $text, $matches);                                     
    if (count($matches) < 2)                                                    
      return "";                           
    else {                                 
      $ip = $matches[1];    
      preg_match($pattern2, $text, $matches);
      $mask = $matches[1];                   
      return $ip . "/" . mask2cidr($mask);   
    }                                        
  } else                                  
    return "";                            
}             

/**
 * Returns a string array of the non trival interfaces on the local machine
 * 
 * @return array<int, array{name: string, net: string}>
 *    Return an array where each element is an interface and its IP address
 */
function get_ifaces() : array {                                                          
  $handle = opendir("/sys/class/net");                                          
  $ifaces = array();
  if ($handle = opendir("/sys/class/net")) {
    $count = 0;                                                                   
    while (false !== ($entry = readdir($handle))) {                               
      switch ($entry) {                                                           
        case ".":                                                                 
        case "..":                                                                
        case "lo":                                                                
        case (preg_match("/dummy/", $entry) ? true : false):                      
        case (preg_match("/tunl/", $entry) ? true : false):
          break;                                       
        default:                                            
          $ifaces[$count++] = array("name" => $entry, "net" => ip_interface($entry));
      }
    }
    closedir($handle);
  }
  return $ifaces;                                                               
}                                                                               

/**
 * A function to test whether a string representation of an IPv4 address is valid. The
 * string can be with or without the mask in CIDR format
 *
 * @param string $addr
 *     The IP address to check if it is valid
 * @param int $nomask
 *     -1 = No mask is used
 *      0 = Autodetect if a mask is used
 *      1 = A mask is used and address in CIDR format
 * @return string
 *     a non empty string if an error occured
 */
function ip_valid(string $addr, int $nomask) : string{
  $addr = trim($addr);
  if ($nomask < 0 || ($nomask == 0 && empty(strpos($addr, "/")))){
    $net = $addr;
  } else {
    $arr = explode("/", $addr, 2);
    $net = $arr[0];
    if (count($arr) == 2)
      $mask = $arr[1];
    else
      $mask = "";
    if (is_numeric($mask)){
      // Check for float value
      if (!empty(strpos($mask, ".")))
        return "The mask is invalid";
      $mask = intval($mask);
      if ($mask < 0 || $mask > 32)
        return "The mask is invalid";
    } else
      return "The mask is invalid";
  }
  $arr = explode(".", $net);
  if (count($arr) != 4)
    return "The address is invalid";
  else {
    foreach ($arr as $value) {
      if (!is_numeric($value))
        return "The address is invalid";
      $val = intval($value);
      if ($val < 0 || $val > 255)
        return "The address is invalid";
    }
  }
  return "";
}

/**
 * A function to test whether a string is a valid IP adress or domain name
 *
 * @param string $addr
 *     The address to test
 * @return string
 *     Returns and empty strig if valid, otherwise the error in the return value
 */
function inet_valid(string $addr) : string {
  # If it starts in a number, it's an IP address
  if (is_numeric($addr[0]))
    return ip_valid($addr, -1);
  else
    return (is_valid_domain($addr) ? "" : "The address is invalid");
}

/**
 * Tests whether a URI is valid, having a protocol that is supported; Protocol must be
 * one of ftp, ftps, sftp, http or https 
 *
 * @param string $uri
 *     The URI to test
 * @return string
 *     Returns an empty string id the URI is valid, otehriwse ther error in the return value
 */
function uri_valid(string $uri) : string {
  $tmp = preg_split('!://!', $uri);
  if (!$tmp || ($tmp[0] != "ftp" && $tmp[0] != "ftps" && $tmp[0] != "sftp" && 
                $tmp[0] != "http" && $tmp[0] != "https"))
    return "The protocol is invalid";
  $s = preg_split(':/:', $tmp[1]);
  if ($s !== false)
    return inet_valid($s[0]);
  else
    return "The protocol is invalid";
}

/**
 * Return an array with each element being one of the rotated log files desired
 *
 * @param string $_file
 *     The base name of the logfile to return. The log $file is return in the first place
 *     $file.0 in the second if it exists, $file.1 in the next, etc  
 * @return array<int, string> 
 *     An array of log files
 */
function dsas_get_logs(string $_file = _DSAS_LOG . "/dsas_verif.log") : array {
  $logs = array();
  foreach (["", ".0", ".1", ".2", ".3", ".4", ".5", ".6", ".7", ".8", ".9"] as $ext) {
    if (is_file($_file . $ext)) {
      $logs[] = (string)file_get_contents($_file . $ext);
    }
  }
  return $logs;
}

/**
 * Returns a string with the requested part of a log file. This allow incrementally downloading 
 * new log elements to the file, skipping the parts alreay downloaded
 *
 * @param int $len
 *     The number of bytes of the file to skip
 * @param string $_file
 *     The log to download from
 * @return string
 *     The new elements of the log file
 */
function dsas_get_log(int $len = 0, string $_file = _DSAS_LOG . "/dsas_verif.log") : string {
  $logs = "";
  if (is_file($_file)) {
    if ($fp = fopen($_file, "r")) {
      if ($len > 0)
        fseek($fp, $len);
      if (filesize($_file) > 0)
        $logs = (string)fread($fp , (int)filesize($_file));
      fclose($fp);
    }
  }
  return $logs;
}

/**
 * A function to create a new SSL certificate and its corresponding CSR for the
 * web site; A 2048 bit RSA key is used a SHA256 digest.
 *
 * @param array<string, string> $options
 *     An array with the X509 options of the certificate to create
 * @return array<mixed>
 *     An array with the errors during the renewal of the web certificate
 */
function renew_web_cert(array $options, int $validity) : array {
  $errors = [];
  $dsas = simplexml_load_file(_DSAS_XML);
  if (! $dsas) {
    $errors[] = ["error" => ["Internal server error : {0}", "Error loading XML file"]];
    return $errors;
  }

  $validity = ($validity < 1 ? 1 : ($validity > 5 ? 5 : $validity)); 
  $days = $validity * 365;
  
  foreach (array('countryName', 'stateOrProvinceName', 'localityName',
             'organizationName', 'organizationalUnitName', 'commonName',
             'commonName', 'emailAddress') as $key) {
    $dsas->config->web->ssl->$key = $options[$key];
  }
  $dsas->config->web->ssl->validity = (string)$validity;
  
  foreach (array('countryName', 'stateOrProvinceName', 'localityName',
                 'organizationName', 'organizationalUnitName', 'commonName',
                 'commonName', 'emailAddress') as $key) {
    if (empty($options[$key]))
      unset($options[$key]);
    else
      $options[$key] = htmlspecialchars($options[$key]);
  }
  
  if ($privkey = openssl_pkey_new(array(
      "private_key_bits" => 2048,
      "private_key_type" => OPENSSL_KEYTYPE_RSA))) {
    openssl_pkey_export($privkey, $pkeyout);
  } else
    $pkeyout = "";
  
  if (($csr = openssl_csr_new($options, $privkey, array("digest_alg" => "sha256")))
    && ($x509 = openssl_csr_sign($csr, null, $privkey, $days, array("digest_alg" => "sha256")))) {
    openssl_csr_export($csr, $csrout);
    openssl_x509_export($x509, $certout);
  } else {
    $csrout ="";
    $certout = "";
  }
  
  if (empty($csrout) || empty($certout) || empty($pkeyout))
    $errors[] =  ["renew" => "Error during the generation of the certificates"];
  else {
    $retval = file_put_contents(_DSAS_VAR . "/dsas.csr", $csrout);
    chmod (_DSAS_VAR . "/dsas.csr", 0640);
    chgrp (_DSAS_VAR . "/dsas.csr", "repo");
    if ($retval !== 0 && $retval !== false) $retval = file_put_contents(_DSAS_VAR . "/dsas_pub.pem", $certout);
    chmod (_DSAS_VAR . "/dsas_pub.pem", 0640);
    chgrp (_DSAS_VAR . "/dsas_pub.pem", "repo");
    if ($retval !== 0 && $retval !== false) $retval = file_put_contents(_DSAS_VAR . "/dsas_priv.pem", $pkeyout);
    chmod (_DSAS_VAR . "/dsas_priv.pem", 0640);
    chgrp (_DSAS_VAR . "/dsas_priv.pem", "repo");
    if ($retval !== 0 && $retval !== false) $retval = file_put_contents(_DSAS_VAR . "/dsas.pem", $pkeyout . PHP_EOL . $certout);
    chmod (_DSAS_VAR . "/dsas.pem", 0640);
    chgrp (_DSAS_VAR . "/dsas.pem", "repo");
    if ($retval === 0 || $retval === false) 
      $errors[] = ["renew" => "Error while saving the certificates"];
    else
      $dsas->asXml(_DSAS_XML);
  }
  return $errors;
}

/**
 * Parse PEM encoded string as a set of X509 certificates. Returns an array
 * with each element a X509 certificate
 *
 * @param string $certfile
 *     A string contains a concatenated set of X509 certificates in PEM formats
 * @return array<int, array<string, mixed>>
 */
function parse_x509(string $certfile) : array {
  if ($fp = fopen($certfile, "r")) {
    $certs = array();
    $incert = false;
    $cert = "";
    while (($line = fgets($fp)) !== false) {
  
      if ("-----BEGIN CERTIFICATE-----" === substr($line,0,-1)){
        if ($incert)
          echo "error parsing ca-bundle.crt";
        else {
          $cert = $line;
          $incert = true;  
        }
      } else if ("-----END CERTIFICATE-----" === substr($line,0,-1)){
        if (!$incert)
          echo "error parsing ca-bundle.crt";
        else {
          $cert = $cert . $line;
          $incert = false;
          $tmp = openssl_x509_parse($cert);
          if ($tmp && ($f = openssl_x509_fingerprint($cert, "sha256"))) {
            $tmp["fingerprint"] = openssl_x509_fingerprint($cert, "sha256");
            $tmp["pem"] = $cert;
            $certs[] = utf8ize($tmp);
          }
        }
      } else if ($incert)
        $cert = $cert . $line;
    }
    fclose($fp);
    return $certs;
  } else
    return []; 
}

/**
 * Convert to UTF8 to be json safe. Array return value
 *
 * @param array<string, mixed> $d
 *    Array or string to convert
 * @return array<string, mixed>
 */
function utf8ize(array $d) : array {
    foreach ($d as $k => $v) {
        $d[$k] = _utf8ize($v);
    }
  return $d;
}

/**
 * Convert to UTF8 to be json safe. Mutable return value
 *
 * @param mixed $d
 *    Array or string to convert
 * @return mixed
 */
function _utf8ize(mixed $d) : mixed {
  if (is_array($d)) {
    foreach ($d as $k => $v) {
        $d[$k] = _utf8ize($v);
    }
  } else if (is_string ($d)) {
    $d = utf8_encode($d);
  }
  return $d;
}

/**
 * Parse a gpg/pgp certificate and return it as a keyed array
 *
 * usage:
 *  parse_gpg($cert)
 *
 * @param string $cert
 *     The certificate in PEM format
 * @return array<string,string>
 *     The certificated returned as a keyed array. The fields are
 *     "uid", "size", "keyid", "fingerprint", "created", "expires", "pem" 
 *     and "authority"
 */
function parse_gpg(string $cert) : array { 
  $retval = [];
  if ($tmp = tempnam("/tmp", "dsas_")) {
    file_put_contents($tmp, $cert);
    $data = [];
    // This use of exec is ok as there are no user parameters, the user data is passed
    // as a file $tmp
    if (exec(escapeshellcmd("/usr/local/bin/gpg -no-default-keyring -vv " . $tmp) . " 2>&1", $text, $ret)) {
      $text = implode(PHP_EOL, $text);                                                                                           
      preg_match("/uid\s+([^\n]+)/", $text, $matches); 
      $data["uid"] = $matches[1]; 
      preg_match("/pub\s+([^\s]+)/", $text, $matches); 
      $data["size"] = $matches[1];  
      preg_match("/keyid:\s+([^\s]+)/", $text, $matches); 
      $data["keyid"] = $matches[1];  
      preg_match("/" . PHP_EOL . "pub.*" . PHP_EOL . "\s+([^\s]+)/", $text, $matches);   
      $data["fingerprint"] = $matches[1];
      preg_match("/created\s+([\d]+)/", $text, $matches); 
      $data["created"] = $matches[1];
      preg_match("/expires\s+([\d]+)/", $text, $matches);
      $data["expires"] = $matches[1];
      $retval = $data;
    }
                          
    unlink($tmp);
  }
  return $retval;
}

/**
 * Test if a string is a valid domain name
 *
 * usage:
 *   is_valid_domain("google.com")
 *
 * @param string $d
 *     The domain name to test if valid
 * @return bool
 *     Return true is the domain is a valid. This doesn't guarentee
 *     the domain exists however
 */
function is_valid_domain(string $d) : bool {
  return (preg_match("/^([a-z\d](-*[a-z\d])*)(\.([a-z\d](-*[a-z\d])*))*$/", $d)
    && preg_match("/^.{1,253}$/", $d)
    && preg_match("/^[^\.]{1,63}(\.[^\.]{1,63})*$/", $d));
}

/**
 * Create a random string to be used as an ID
 *
 * usage:
 *   dsas_id(32)
 *
 * @param int $len
 *     The length of the ID string to create (24 by default)
 * @return string
 *     A random hexadecimal string of length $len
 */
function dsasid(int $len = 24) : string {
  $len = (int)ceil($len/2);
  if ($len < 4)
    $len = 4;
  if (function_exists("random_bytes")) {
    $bytes = random_bytes($len);
  } elseif (function_exists("openssl_random_pseudo_bytes")) {
    $bytes = openssl_random_pseudo_bytes($len);
  } else {
    throw new Exception("no cryptographically secure random function available");
  }
  return substr(bin2hex((string)$bytes), 0, 2 * $len);
}

/**
 * Test if a task given by $id is running, the ID will appear in the process table
 *
 * usage:
 *    dsas_task_running($id)
 *
 * @param string $id
 *    The ID string of the task to test the status of
 * @return bool
 *    Return true if the task is running 
 */
function dsas_task_running(string $id) : bool {
   $ret = dsas_exec(["sudo", "pgrep", "-f", "$id"]);
   return ($ret["retval"] === 0);
}

/**
 * Test the status of a DSAS task
 *
 * usage:
 *   dsas_run_log($id)
 *
 * @param string $id
 *     The ID string of the task to test the status of
 * @return array<string, string>
 *     Return last run time and whether the task run successfully or not or is still running
 */
function dsas_run_log(string $id) : array {
 $run = dsas_task_running($id);
 if (is_file(_DSAS_LOG . "/dsas_runlog")) {
    if ($fp = fopen(_DSAS_LOG . "/dsas_runlog", "r")) {
      while (($line = fgets($fp)) !== false) {
        if ($id == substr($line,0,strlen($id))) {
           $tmp = preg_split("/\s+/", $line);
           if ($tmp !== false && count($tmp) > 2)
             return array("last" => $tmp[1], "status" => ($run ? "Running" : ($tmp[2] === "0" ? "Ok" : "Failed")));
           else
             break;
        }
      }
    }
  }
  return array("last" => "never", "status" => ($run ? "Running" : "Ok"));
}

/**
 * Check a file extracted from the $_FILES variable for possible attacks
 *
 * usage:
 *   check_files($_FILES["file"], "text/plain")
 *
 * @param array{error: int, size: int, tmp_name: string} $files
 *    A file extracted form $_FILES to be checked
 * @param string $mime_type
 *    The desired mime-type of the file. Really test it rather than depending
 *    on what the user tells us it is   
 */
function check_files(array $files, string $mime_type) : void {
  // Protect against corrupted $_FILES array, so yes it is normal that we're 
  // testing that we aren't passed what we want. Tell PHPSTAN to shutup
  // @phpstan-ignore-next-line
  if (!isset($files["error"]) || is_array($files["error"]))
    throw new RuntimeException("Invalid parameter");

  switch ($files["error"]) {
    case UPLOAD_ERR_OK:
      break;
    case UPLOAD_ERR_NO_FILE:
      throw new RuntimeException("No file sent");
    case UPLOAD_ERR_INI_SIZE:
    case UPLOAD_ERR_FORM_SIZE:
      throw new RuntimeException("Exceeded filesize limit");
    default:
      throw new RuntimeException("Unknown error");
  }

  // 100 Mo hard limit
  if ($files["size"] > 100000000)
    throw new RuntimeException("Execeed filesize limit");

  // Don't trust passed mime type. Test it
  $finfo = new finfo(FILEINFO_MIME_TYPE);
  if ($finfo->file($files["tmp_name"]) !== $mime_type)
    throw new RuntimeException("Invalid file format");
}

/**
 * Function to insert an XML node at a particular position in a SimpleXMLElement.
 * See https://stackoverflow.com/questions/3361036/
 *
 * usage:
 *   simplexml_insert_after($xmlelement, $xml->node[3])
 *
 * @param SimpleXMLElement $insert
 *    The node to be inserted
 * @param SimpleXMLElement $target
 *    The node after which the node is to be inserted
 */
function simplexml_insert_after(SimpleXMLElement $insert, SimpleXMLElement $target) : void {
  $target_dom = dom_import_simplexml($target);
  if ($target_dom->ownerDocument && $target_dom->parentNode) {
    $insert_dom = $target_dom->ownerDocument->importNode(dom_import_simplexml($insert), true);
    if ($target_dom->nextSibling)
      $target_dom->parentNode->insertBefore($insert_dom, $target_dom->nextSibling);
    else
      $target_dom->parentNode->appendChild($insert_dom);
  }
}

/**
 * Function retrieve the status of the two DSAS machines
 *
 * usage:
 *   dsas_status()
 *
 * @return array{bas: array<string,mixed>, haut: array<string,mixed>}
 *    The status of the two machines is returned independantly in two arrays
 */
function dsas_status() {
  $output = dsas_exec(["free", "-b"]);
  $free = $output["stdout"];
  $free = (string)trim($free);
  $free_arr = explode("\n", $free);
  $mem = explode(" ", $free_arr[1]);
  $mem = array_filter($mem);
  $mem = array_merge($mem);
  $output = dsas_exec(["cat", "/proc/cpuinfo"]);
  $cpuinfo = $output["stdout"];
  preg_match("/^cpu cores.*:(.*)$/m", $cpuinfo, $matches);
  $cores = trim($matches[1]);
  $output = dsas_exec(["cat", "/proc/loadavg"]);
  $loadavg = explode(" ", $output["stdout"])[0];
  $d = _DSAS_HOME;
  $bas = ["disk" =>  $d,
          "disk_free" => disk_free_space($d),
          "disk_total" => disk_total_space($d),
           // With a ramdisk, the free memory is pretty much false. Used 'Total - Avail' instead
          "memory_used" => (float)$mem[1] - (float)$mem[6],
          "memory_total" => (float)$mem[1],
          "cores" => (int)$cores,
          "loadavg" => (float)$loadavg];

  # test if the machine haut is alive before proceeding
  $hautip = interco_haut();
  $output = dsas_exec(["ping", "-q", "-c", "1", "-W", "1", $hautip]);
  if ($output["retval"] == 0) {
    $output = dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "-M", "-S", "/tmp/sshsocket", "-o", "ControlPersist=5s", "tc@" . $hautip, "free", "-b"]);
    $free = $output["stdout"];
    $free = (string)trim($free);
    $free_arr = explode("\n", $free);
    $mem = explode(" ", $free_arr[1]);
    $mem = array_filter($mem);
    $mem = array_merge($mem);
    $output = dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "-S", "/tmp/sshsocket", "tc@" . $hautip, "cat", "/proc/loadavg", "/proc/cpuinfo"]);
    $loadavg = explode(" ", $output["stdout"])[0];
    $cpuinfo = $output["stdout"];
    preg_match("/^cpu cores.*:(.*)$/m", $cpuinfo, $matches);
    $cores = trim($matches[1]);
    $output = dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "-S", "/tmp/sshsocket", "tc@" . $hautip, "stat", "-f", "-c", "'%S %a %b'", $d]);
    $output_arr = explode(" ", (string)trim($output["stdout"]));
    $blksz = (int)$output_arr[0];
    $free = (int)$output_arr[1] * $blksz;
    $total = (int)$output_arr[2] * $blksz;
    $haut = ["status" => "up",
             "disk" =>  $d,
             "disk_free" => $free,
             "disk_total" => $total,
             "memory_used" => (float)$mem[1] - (float)$mem[6],
             "memory_total" => (float)$mem[1],
             "cores" => (int)$cores,
             "loadavg" => (float)$loadavg];
  } else
    $haut = ["status" => "down",
             "disk" =>  $d,
             "disk_free" => 1,
             "disk_total" => 1,
             "memory_used" => 0,
             "memory_total" => 1,
             "cores" => 1,
             "loadavg" => (float)0.0];

  return ["haut" => $haut, "bas" => $bas];
}

/**
 * Function to set the DSAS network settings
 *
 * usage:
 *   dsas_net($data)
 *
 * @param array{bas: array{dhcp: string, cidr: string, gateway: string, 
 *                       dns: array{domain: string, nameserver: string[]}},
 *            haut: array{dhcp: string, cidr: string, gateway: string, 
 *                       dns: array{domain: string, nameserver: string[]}}} $data
 *    The parameters to use for the network configuration of the two interface
 *
 * @return array<int,mixed>
 *    An array of the errors found in the configuration
 */
function dsas_net($data) {
  $errors = array();
  try {
    $dsas = simplexml_load_file(_DSAS_XML);
    if (! $dsas)
      throw new RuntimeException("Error loading XML file");

    $ifaces = get_ifaces();
    $j=0;
    foreach (["bas", "haut"] as $iface) {
      $net = $data[$iface];

      if ($net["dhcp"] == "true") {
        $dsas->config->network->{$iface}->dhcp = "true";
        $j++;
        continue;
      } else
        $dsas->config->network->{$iface}->dhcp = "false";

      $cidr = htmlspecialchars(trim($net["cidr"]));
      $cidr_err = ip_valid($cidr, 1);
      if (empty($cidr_err))
        $dsas->config->network->{$iface}->cidr = $cidr;
      else
        $errors[] = [ "iface_cidr" . $j => $cidr_err];

      $gateway = htmlspecialchars(trim($net["gateway"]));
      if (empty($gateway))
        $gateway_err = "";
      else
        $gateway_err = ip_valid($gateway, -1);
      if (empty($gateway_err))
        $dsas->config->network->{$iface}->gateway = $gateway;
      else
        $errors[] = [ "iface_gateway" . $j => $gateway_err];

      if (empty($net["dns"]["domain"]) || is_valid_domain($net["dns"]["domain"]))
         $dsas->config->network->{$iface}->dns->domain = $net["dns"]["domain"];
      else
         $errors[] = [ "iface_dns_domain" . $j => "Domain is invalid"];
      
      foreach ($net["dns"]["nameserver"] as $server) {
        if (!empty($dns_err = ip_valid($server, -1)))
          break;
      }
      if (empty($dns_err)) {
        unset($dsas->config->network->{$iface}->dns->nameserver);
        foreach ($net["dns"]["nameserver"] as $server)
          $dsas->config->network->{$iface}->dns->nameserver[] = $server;
      } else
        $errors[] = ["iface_nameserver" .$j => $dns_err];

      $j++;
    }
  } catch (Exception $e) {
     $errors[] = ["error" => ["Internal server error : {0}", $e->getMessage()]];
  }
  if ($dsas !== false && $errors == [])
    $dsas->asXml(_DSAS_XML);
    
  return $errors;
}

/**
 * Function to set the DSAS service settings
 *
 * usage:
 *   dsas_service($data)
 *
 * @param array{ssh: array{active: string, user_tc: string, 
 *                      user_bas: string, user_haut: string},
 *                      radius: array{active: string, server: string, secret: string, domain: string},
 *                      syslog: array{active: string, server: string},
 *                      ntp: array{active: string, server: array{string}},
 *                      antivirus: array{active: string, uri: string},
 *                      web: array{repo: string},
 *                      snmp: array{active: string, username: string, password: string,
 *                                  encrypt: string, passpriv: string, 
 *                                  privencrypt: string}} $data
 *
 * @return array<int,mixed>
 *    An array of the errors found in the configuration
 */
function dsas_service($data) {
  $errors = array();
  try {
    $dsas = simplexml_load_file(_DSAS_XML);
    if (! $dsas)
      throw new RuntimeException("Error loading XML file");

    $dsas->config->ssh->active = ($data["ssh"]["active"] === "true" ? "true" : "false");
    $user_tc = htmlspecialchars(trim($data["ssh"]["user_tc"]));
    $user_tc_err = "";
    if (! empty($user_tc)) {
      foreach (explode(",",$user_tc) as $inet) {
        if (substr($inet,0,1) === "!")
          $inet = substr($inet,1,strlen($inet)-1); 
        if ($user_tc_err = ip_valid($inet, 0))
          break;
      }
    }
    if (empty($user_tc_err))
      $dsas->config->ssh->user_tc = $user_tc;
    else
      $errors[] = [ "user_tc" => $user_tc_err];

    $user_bas = htmlspecialchars(trim($data["ssh"]["user_bas"]));
    $user_bas_err = "";
    if (! empty($user_bas)) {
      foreach (explode(",",$user_bas) as $inet) {
        if (substr($inet,0,1) === "!")
          $inet = substr($inet,1,strlen($inet)-1); 
        if ($user_bas_err = ip_valid($inet, 0))
          break;
      }
    }
    if (empty($user_bas_err))
      $dsas->config->ssh->user_bas = $user_bas;
    else
      $errors[] = [ "user_bas" => $user_bas_err];

    $user_haut = htmlspecialchars(trim($data["ssh"]["user_haut"]));
    $user_haut_err = "";
    if (! empty($user_haut)) {
      foreach (explode(",",$user_haut) as $inet) {
        if (substr($inet,0,1) === "!")
          $inet = substr($inet,1,strlen($inet)-1); 
        if ($user_haut_err = ip_valid($inet, 0))
          break;
      }
    }
    if (empty($user_haut_err))
      $dsas->config->ssh->user_haut = $user_haut;
    else
      $errors[] = [ "user_haut" => $user_haut_err];
    $dsas->config->radius->active = ($data["radius"]["active"] === "true" ? "true" : "false");
    $radius_server = htmlspecialchars(trim($data["radius"]["server"]));
    if (! empty($radius_server))
      $radius_server_err = inet_valid($radius_server);
    if (empty($radius_server_err))
      $dsas->config->radius->server = $radius_server;
    else
      $errors[] = ["radius_server" => $radius_server_err];
    $radius_secret = htmlspecialchars(trim($data["radius"]["secret"]));
    # FIXME should we control the complexity of the radius secret ?
    if ($radius_secret == trim($data["radius"]["secret"]))
      $dsas->config->radius->secret = $radius_secret;
    else
      $errors[] = ["radius_secret" => "Illegal radius secret"]; // Avoid XSS at least
    $radius_domain = htmlspecialchars(trim($data["radius"]["domain"]));
    if (! empty($radius_domain))
      $radius_domain_err = (preg_match("/^[a-zA-Z\d][a-zA-Z\d-]*$/", $radius_domain) ? "" : "The radius domain is invalid");
    if (empty($radius_domain_err))
      $dsas->config->radius->domain = $radius_domain;
    else
      $errors[] = ["radius_domain" => $radius_domain_err];
    $dsas->config->syslog->active = ($data["syslog"]["active"] === "true" ? "true" : "false");
    $dsas->config->ntp->active = ($data["ntp"]["active"] === "true" ? "true" : "false");

    $syslog_server = htmlspecialchars(trim($data["syslog"]["server"]));
    if (! empty($syslog_server))
      $syslog_err = inet_valid($syslog_server);
    if (empty($syslog_err))
      $dsas->config->syslog->server = $syslog_server;
    else
      $errors[] = ["syslog_server" => $syslog_err];

    foreach ($data["ntp"]["server"] as $server) {
      if (!empty($pool_err = inet_valid($server)))
        break;
    }
    if (empty($pool_err)) {
      unset($dsas->config->ntp->server);
      foreach ($data["ntp"]["server"] as $server)
        // The ntp[0] is here just to avoid a level 9 PHPStan error
        $dsas->config->ntp[0]->server[] = $server;
    } else
      $errors[] = ["ntp_pool" => $pool_err];

    $dsas->config->antivirus->active = ($data["antivirus"]["active"] === "true" ? "true" : "false");
    $antivirus_uri = htmlspecialchars(trim($data["antivirus"]["uri"]));
    if (! empty($antivirus_uri))
      $antivirus_err = uri_valid($antivirus_uri);
    // Set ClamAV client UUID if empty
    if (empty($dsas->config->antivirus->uuid))
      $dsas->config->antivirus->uuid = sprintf("%04x%04x-%04x-%04x-%04x-%04x%04x%04x",
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff), mt_rand(0, 0x0fff) | 0x4000, // 4 MSB contain version 4 number
        mt_rand(0, 0x3fff) | 0x8000, // 2 MSB holds DCE1.1 variant
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
    if (empty($antivirus_err))
      $dsas->config->antivirus->uri = $antivirus_uri;
    else
      $errors[] = ["antivirus_uri" => $antivirus_err];

    $dsas->config->web->repo = ($data["web"]["repo"] === "true" ? "true" : "false");

    $dsas->config->snmp->active = ($data["snmp"]["active"] === "true" ? "true" : "false");
    $snmp_username = htmlspecialchars(trim($data["snmp"]["username"]));
    if (($data["snmp"]["active"] === "true") && empty($snmp_username))
      $errors[] = ["snmp_user" => "Empty SMNP Username"];
    else if (preg_match('/[^A-Za-z0-9]/', $snmp_username))
      $errors[] = ["snmp_user" => ["Username '{0}' is illegal", $snmp_username]];
    else
      $dsas->config->snmp->username = $snmp_username;

    $snmp_password = htmlspecialchars($data["snmp"]["password"]);
    if ($snmp_password != $data["snmp"]["password"])
      $errors[] = ["snmp_pass" => "The SNMP password is illegal"];
    else if ($snmp_password != str_replace("/\s+/", "", $snmp_password))
      $errors[] = ["snmp_pass" => "The SNMP password can not contain white spaces"];
    else if ($dsas->config->snmp->active == "true" && ! complexity_test($snmp_password))
      $errors[] = ["snmp_pass" => "The SNMP password is insufficiently complex"];
    else
      $dsas->config->snmp->password = $snmp_password;
    $snmp_encrypt = htmlspecialchars($data["snmp"]["encrypt"]);
    if ($snmp_encrypt !== "MD5" && $snmp_encrypt !== "SHA" 
        && $snmp_encrypt !== "SHA256" && $snmp_encrypt !== "SHA512")
      $errors[] = ["error" => "The SNMP authentication encryption is illegal"];
    else
      $dsas->config->snmp->encrypt = $snmp_encrypt;

    $snmp_passpriv = htmlspecialchars($data["snmp"]["passpriv"]);
    if ($snmp_passpriv != $data["snmp"]["passpriv"])
      $errors[] = ["snmp_passpriv" => "The SNMP password is illegal"];
    else if ($snmp_passpriv != str_replace("/\s+/", "", $snmp_passpriv))
      $errors[] = ["snmp_passpriv" => "The SNMP password can not contain white spaces"];
    else if ($dsas->config->snmp->active == "true" && ! complexity_test($snmp_passpriv))
      $errors[] = ["snmp_passpriv" => "The SNMP password is insufficently complex"];
    else
      $dsas->config->snmp->passpriv = $snmp_passpriv;
    $snmp_privencrypt = htmlspecialchars($data["snmp"]["privencrypt"]);
    if ($snmp_privencrypt !== "DES" && $snmp_privencrypt !== "AES" 
        // These additional non-standard options require that net-snmp is compiled with
        // the --enable-blumenthal-aes 
        // && $snmp_privencrypt !== "AES192" && $snmp_privencrypt !== "AES192C" 
        // && $snmp_privencrypt !== "AES256" && $snmp_privencrypt !== "AES256C"
        )
      $errors[] = ["error" => "The SNMP privacy encryption is illegal"];
    else
      $dsas->config->snmp->privencrypt = $snmp_privencrypt;
  } catch (Exception $e) {
     $errors[] = ["error" => ["Internal server error : {0}", $e->getMessage()]];
  }
  if ($dsas !== false && $errors == [])
    $dsas->asXml(_DSAS_XML);
    
  return $errors;
}

/**
 * Function to delete a certificate form the DSAS  configuration
 *
 * usage:
 *   dsas_delete_cert($finger)
 *
 * @param string $finger
 *
 * @return array<int,mixed>
 *    An array of the errors found in the configuration
 */
function dsas_delete_cert($finger) {
  $errors = array();
  try {
    $dsas = simplexml_load_file(_DSAS_XML);
    if (! $dsas)
      throw new RuntimeException("Error loading XML file");

    $certok = false;
    $i = 0;
    foreach ($dsas->certificates->certificate as $certificate) {
      if ($certificate->type == "x509") {
        if (openssl_x509_fingerprint(trim($certificate->pem), "sha256") == $finger) {
          $certok = true;
          break;
        }
      } else if ($certificate->type == "pubkey") {
        $pem = htmlspecialchars(trim($certificate->pem));
        $pemnowrap = (string)preg_replace('/^-----BEGIN (?:[A-Z]+ )?PUBLIC KEY-----([A-Za-z0-9\\/\\+\\s=]+)-----END (?:[A-Z]+ )?PUBLIC KEY-----$/ms', '\\1', $pem);
        $pemnowrap = (string)preg_replace('/\\s+/', '', $pemnowrap);
        if (hash("sha256", base64_decode($pemnowrap)) == $finger) {
          $certok = "true";
          break;
        }
      } else {
        $cert = parse_gpg(trim($certificate->pem));
        if ($cert["fingerprint"]  == $finger) {
          $certok = true;
          break;
        }
      }
      $i++;
    }
    if (! $certok)
      $errors[] = [ "delete" => "The certificate doesn't exist"];
    else {
      foreach ($dsas->tasks->task as $task) {
        foreach ($task->cert as $cert) {
          if ($cert->fingerprint == $finger) {
            $certok = false;
            $errors[] = [ "delete" => ["The certificate is used by the task '{0}'", (string)$task->name]];
          }
        }
      }
      if ($certok)
        unset($dsas->certificates->certificate[$i]);
    }
  } catch (Exception $e) {
     $errors[] = ["error" => ["Internal server error : {0}", $e->getMessage()]];
  }
  if ($dsas !== false && $errors == [])
    $dsas->asXml(_DSAS_XML);
    
  return $errors;
}

/**
 * Function to delete a certificate form the DSAS  configuration
 *
 * usage:
 *   dsas_upload_cert($type, $file, $mime)
 *
 * @param string $type
 * @param array{error: int, size: int, tmp_name: string} $file
 * @param string $mime
 *
 * @return array<int,mixed>
 *    An array of the errors found in the configuration
 */
function dsas_upload_cert($type, $file, $mime) {
  $errors = array();
  try {
    $dsas = simplexml_load_file(_DSAS_XML);
    if (! $dsas)
      throw new RuntimeException("Error loading XML file");

    // PEM files are detected as text/plain
    check_files($file, $mime);

    $cert = htmlspecialchars((string)file_get_contents($file["tmp_name"]));
    $cert = str_replace("\r", "", $cert);   // dos2unix
    switch ($type) {
      case "x509":
        $parse = openssl_x509_parse($cert);
        $finger = openssl_x509_fingerprint(trim($cert), "sha256");
        if (! $parse)
          throw new RuntimeException("The X509 file must be in PEM format");
        foreach ($dsas->certificates->certificate as $certificate) {
          if ($certificate->type == $type) {
            if (openssl_x509_fingerprint(trim($certificate->pem), "sha256") == $finger)
              throw new RuntimeException("The X509 certificate already exists");
          }
        }
        break;

      case "pubkey":
        $pubkeynowrap = preg_replace('/^-----BEGIN (?:[A-Z]+ )?PUBLIC KEY-----([A-Za-z0-9\\/\\+\\s=]+)-----END (?:[A-Z]+ )?PUBLIC KEY-----$/ms', '\\1', $cert);
        if (($cert === $pubkeynowrap) || empty($pubkeynowrap))
          throw new RuntimeException("The public key must be in PEM format");
        $pubkeynowrap = (string)preg_replace('/\\s+/', '', $pubkeynowrap);
        $finger = hash("sha256", base64_decode($pubkeynowrap));
        foreach ($dsas->certificates->certificate as $certificate) {
          if ($certificate->type == "pubkey") {
            $pem = htmlspecialchars(trim($certificate->pem));
            $pemnowrap = (string)preg_replace('/^-----BEGIN (?:[A-Z]+ )?PUBLIC KEY-----([A-Za-z0-9\\/\\+\\s=]+)-----END (?:[A-Z]+ )?PUBLIC KEY-----$/ms', '\\1', $pem);
            $pemnowrap = (string)preg_replace('/\\s+/', '', $pemnowrap);
            if (hash("sha256", base64_decode($pemnowrap)) == $finger)
              throw new RuntimeException("The public key already exists");
          }
        }
        break;
      
      case "gpg":
        $parse = parse_gpg($cert);
        if (! $parse)
          throw new RuntimeException("The GPG file must be in PEM format" );

        foreach ($dsas->certificates->certificate as $certificate) {
          if ($certificate->type == "gpg") {
            $_cert =  parse_gpg(trim($certificate->pem));
            if ($_cert["fingerprint"] == $parse["fingerprint"])
              throw new RuntimeException("The GPG certificate already exists");
          }
        }
        break;

      default:
        throw new RuntimeException("Invalid certificate type");
    }

    $newcert = $dsas->certificates->addChild("certificate");
    $newcert->type = $type;
    $newcert->pem = trim($cert);
    if ($type == "x509") 
      $newcert->authority = (empty($parse["extensions"]["authorityKeyIdentifier"]) || 
        (!empty($parse["extensions"]["subjectKeyIdentifier"]) && str_contains($parse["extensions"]["authorityKeyIdentifier"],
        $parse["extensions"]["subjectKeyIdentifier"])) ? "true" : "false");
    else
      $newcert->authority = "true";

    $dsas->asXml(_DSAS_XML);
  } catch (RuntimeException $e) {
    $errors[] = [$type . "_upload" => $e->getMessage()];
  }

  return $errors;
}


/**
 * Function to change position of certificates in DSAS configuration
 *
 * usage:
 *   dsas_drag_cert($from_finger, $to_finger)
 *
 * @param string $from_finger
 *   The SHA256 fingerprint of the certificate to move
 * @param string $to_finger
 *   The SHA256 fingerprint of the certificate destination
 *
 * @return array<int,mixed>
 *    An array of the errors found in the configuration
 */
function dsas_drag_cert($from_finger, $to_finger) {
  $errors = array();
  $type = "x509";
  try {
    $dsas = simplexml_load_file(_DSAS_XML);
    if (! $dsas)
      throw new RuntimeException("Error loading XML file");

    $from = -1;
    $to = -1;
    $i = 0;
    foreach ($dsas->certificates->certificate as $certificate) {
      if ($certificate->type == "x509") {
        if (openssl_x509_fingerprint(trim($certificate->pem), "sha256") == $from_finger) {
          $from = $i;
          $type = "x509";
        }
        if (openssl_x509_fingerprint(trim($certificate->pem), "sha256") == $to_finger) {
          $to = $i;
        }
      } else if ($certificate->type == "pubkey") {
        $pem = htmlspecialchars(trim($certificate->pem));
        $pemnowrap = (string)preg_replace('/^-----BEGIN (?:[A-Z]+ )?PUBLIC KEY-----([A-Za-z0-9\\/\\+\\s=]+)-----END (?:[A-Z]+ )?PUBLIC KEY-----$/ms', '\\1', $pem);
        $pemnowrap = (string)preg_replace('/\\s+/', '', $pemnowrap);
        if (hash("sha256", base64_decode($pemnowrap)) == $from_finger) {
          $from = $i;
          $type = "pubkey";
        }
        if (hash("sha256", base64_decode($pemnowrap)) == $to_finger) {
          $to = $i;
        }
      } else {
        $cert = parse_gpg(trim($certificate->pem));
        if ($cert["fingerprint"]  == $from_finger) {
          $from = $i;
          $type = "gpg";
        }
        if ($cert["fingerprint"]  == $to_finger) {
          $to = $i;
        }
      }
      if ($from !== -1 && $to !== -1) break;
      $i++;
    }

    if ($from == -1) {
      $errors[] = ["error" => "The certificate drag from value is invalid"];
    } else if ($to == -1) {
      $errors[] = ["error" => "The certificate drag to value is invalid"];
    } else {
      $nt =  $dsas->certificates[0]->count();
      if ($from !== $to && $from !== $to + 1) {
        $cert = new SimpleXMLElement($dsas->certificates[0]->certificate[$from]->asXML());
        $cert_to = $dsas->certificates[0]->certificate[$to];
        unset($dsas->certificates->certificate[$from]);
        simplexml_insert_after($cert, $cert_to);
      }
      $dsas->asXml(_DSAS_XML);
    }
   } catch (RuntimeException $e) {
    $errors[] = [$type . "_upload" => $e->getMessage()];
  }

  return $errors;
}     

/**
 * Function to list all certificates available to the DSAS 
 *
 * usage:
 *   dsas_get_cert()
 *
 * @return array{array{dsas: array{x509: array<int,mixed>, pubkey: array<int,mixed>, gpg: array<int,mixed>}, ca: array<int,mixed>}}
 */
function dsas_get_cert() {
  $dsas = simplexml_load_file(_DSAS_XML);
  if (! $dsas)
    throw new RuntimeException("Error loading XML file");

  $cafile = dsas_ca_file();
  if ($cafile)
    $ca = parse_x509($cafile);
  else
    $ca = array();
  $dsas_x509 = array();
  $dsas_gpg = array();
  $dsas_pubkey = array();
  foreach ($dsas->certificates->certificate as $certificate) {
    if ($certificate->type == "x509") {
      $p = openssl_x509_parse(trim($certificate->pem));
      if ($p !== false) {
        $cert =  utf8ize($p);
        $cert["pem"] = trim($certificate->pem[0]);
        $cert["fingerprint"] = openssl_x509_fingerprint(trim($certificate->pem[0]), "sha256");
        $cert["authority"] = trim($certificate->authority);
        $dsas_x509[] = $cert;
      }
    } else if ($certificate->type == "gpg") {
      $cert = utf8ize(parse_gpg($certificate->pem));
      $cert["pem"] = trim($certificate->pem[0]);
      $cert["authority"] = trim($certificate->authority);
      $dsas_gpg[] = $cert;
    } else if ($certificate->type == "pubkey") {
      $cert = array();
      $cert["pem"] = trim($certificate->pem[0]);
      $cert["name"] = trim($certificate->name);
      $cert["authority"] = trim($certificate->authority);
      $pemnowrap = (string)preg_replace('/^-----BEGIN (?:[A-Z]+ )?PUBLIC KEY-----([A-Za-z0-9\\/\\+\\s=]+)-----END (?:[A-Z]+ )?PUBLIC KEY-----$/ms', '\\1', (string)$certificate->pem[0]);
      $pemnowrap = (string)preg_replace('/\\s+/', '', $pemnowrap);
      $cert["fingerprint"] = hash("sha256", base64_decode($pemnowrap));
      $dsas_pubkey[] = $cert;
    } 
  } 

  return [["dsas" => ["x509" => $dsas_x509, "pubkey" => $dsas_pubkey, "gpg" => $dsas_gpg], "ca" => $ca]];
}

/**
 * Function to add a task to DSAS settings
 *
 * usage:
 *   dsas_add_task($data)
 *
 * @param array{name: string, id: string, type: string, 
 *              run: string, directory: string, uri: string,
 *              ca: array{name: string, fingerprint: string},
 *              archs: array{array{arch: string, active: string}},
 *              certs: array{array{name: string, fingerprint: string}}} $data
 *
 * @return array<int,mixed>
 *    An array of the errors found in the configuration
 */
function dsas_add_task($data) {
  $errors = array();
  try {
    $dsas = simplexml_load_file(_DSAS_XML);
    if (! $dsas)
      throw new RuntimeException("Error loading XML file");

    $name = htmlspecialchars($data["name"]);
    if ($name != $data["name"])
      $errors[] = ["error" => "Illegal task name"];
    if (trim($name) == "")
      $errors[] = ["error" => "The name can not be empty"];
    $id = $data["id"];
    $directory = htmlspecialchars($data["directory"]);
    if ($directory != $data["directory"])
      $errors[] = ["error" => "Illegal directory name"];
    if (trim($directory) == "")
      $errors[] = ["error" => "The directory name can not be empty"];
    $uri =  htmlspecialchars($data["uri"]);
    if ($uri != $data["uri"])
      $errors[] = ["error" => "Illegal uri"];
    $type = $data["type"];
    if ($type !== "rpm" && $type !== "repomd" && $type !== "deb" && $type !== "authenticode" &&
        $type !== "openssl" && $type !== "gpg" && $type !== "liveupdate" && $type !== "cyberwatch" &&
        $type != "jar" && $type !== "trend")
      $errors[] = ["error" => "The task type is illegal"];
    $run = $data["run"];
    if ($run !== "never" && $run !== "quarterhourly" && $run !== "hourly" && $run !== "daily" && $run !== "weekly" && $run !== "monthly")
      $errors[] = ["error" => "The period between execution of the task is illegal"];
    $ca = $data["ca"];
    $ca_finger = strtolower(trim($ca["fingerprint"]));
    $ca_name = htmlspecialchars(trim($ca["name"]));
    if ($ca_finger !== "" && $ca_finger !== "self") {
      $ca_ok = false;
      foreach ($dsas->certificates->certificate as $certificate) {
        if ($certificate->type == "x509") {
          if ($certificate->authority == "true") {
            if (openssl_x509_fingerprint(trim($certificate->pem), "sha256") == $ca_finger) {
              $ca_ok = true;
              break;
            }
          }
        }
      }
      if (! $ca_ok)
        $errors[] = ["error" => "Certificate authority not found"];
    }

    if ($type === "deb") {
      foreach ($data["archs"] as $arch) {
        switch ($arch["arch"]){
          case "source":
          case "all":
          case "amd64":
          case "arm64":
          case "armel":
          case "armhf":
          case "i386":
          case "mips64el":
          case "mipsel":
          case "ppc64el":
          case "s390x":
            // Architecture ok
            if ($arch["active"] !== "true" && $arch["active"] !== "false") {
              $errors[] = ["error" => "Invalid debian architecture"];
              break 2;
            }
            break;
          default:
            $errors[] = ["error" => "Invalid debian architecture"];
            break 2;
        }
      }
    }

    $certs = array();
    $have_ca = false;
    $have_pubkey = false;
    $have_x509 = false;
    foreach ($data["certs"] as $cert) {
      $certok = false;
      $certname = "";
      foreach ($dsas->certificates->certificate as $certificate) {
        if ($certificate->type == "x509") {
          if (openssl_x509_fingerprint(trim($certificate->pem), "sha256") == $cert["fingerprint"]) {
            if ($certificate->authority == "true") {
              if ($have_ca && $type !== "liveupdate" && $type !== "trend") {
                $errors[] = ["error" => ["The task type '{0}' only supports one root certificate", $type]];
                break 2;
              }
              $have_ca = true;
            }
            if ($type === "rpm" || $type === "repomd" || $type === "deb" || $type === "gpg") {
              $errors[] = ["error" => ["The task type '{0}' does not support {1} certificates", $type, "X509"]];
              break 2;
            }
            
            if ($have_pubkey && ($type === "cyberwatch" || $type === "openssl")) {
              $errors[] = ["error" => ["The task type '{0}' can not include both public keys and X509 certificates", $type]];
              break 2;
            } 

            $certok = true;
            $have_x509 = true;
            $x509_cert = openssl_x509_parse(trim($certificate->pem));
            if ($x509_cert === false)
              $certname ="";
            else if ($x509_cert["subject"]["CN"])
              $certname = $x509_cert["subject"]["CN"];
            else if ($x509_cert["subject"]["OU"])
              $certname = $x509_cert["subject"]["OU"];
            else if ($x509_cert["subject"]["O"])
              $certname = $x509_cert["subject"]["O"];
            else if ($x509_cert["extensions"]["subjectKeyIdentifier"])
              $certname = $x509_cert["extensions"]["subjectKeyIdentifier"];
            else
              $certname = "";
            break;
          }
        }
        if ($certificate->type == "gpg") {
          $gpg_cert =  parse_gpg(trim($certificate->pem));
          if ($gpg_cert["fingerprint"] == $cert["fingerprint"]) {
            if ($type === "authenticode" || $type === "openssl" || $type === "liveupdate" || $type === "jar" || $type === "trend") {
              $errors[] = ["error" => ["The task type '{0}' does not support {1} certificates", $type, "GPG"]];
              break 2;
            }
            if ($type == "gpg" && $have_ca) {
              $errors[] = ["error" => ["The task type '{0}' only supports one GPG certificate", $type]];
              break 2;
            }
            $certname = $gpg_cert["uid"];
            $certok = true;
            $have_ca = true;
            break;
          }
        }

        if ($certificate->type == "pubkey") {
          $pem = trim($certificate->pem[0]);
          $pemnowrap = (string)preg_replace('/^-----BEGIN (?:[A-Z]+ )?PUBLIC KEY-----([A-Za-z0-9\\/\\+\\s=]+)-----END (?:[A-Z]+ )?PUBLIC KEY-----$/ms', '\\1', $pem);
          $pemnowrap = (string)preg_replace('/\\s+/', '', $pemnowrap);
          if (hash("sha256", base64_decode($pemnowrap)) == $cert["fingerprint"]) {
            if ($type === "rpm" || $type === "repomd" || $type === "deb" || 
                $type === "authenticode" || $type === "gpg" || $type === "liveupdate" ||
                $type === "jar" || $type === "trend") {
              $errors[] = ["error" => ["The task type '{0}' does not support public keys", $type]];
              break 2;
            }
            if ($have_x509) {
              $errors[] = ["error" => ["The task type '{0}' can not include both public keys and X509 certificates", $type]];
              break 2;
            }
            if ($have_pubkey) {
              $errors[] = ["error" => ["The task type '{0}' can only support a single public key", $type]];
              break 2;
            }

            $certname = $certificate->name;
            $certok = true;
            $have_pubkey = true;
            break;
          }
        }
      }

      if (! $certok) {
        $cafile = dsas_ca_file();                                                      
        if ($cafile) {
          // The format of an x509 can be quite arbitrary. So only 
          // declare the bits I need here
          /** @var array{array{fingerprint: string, pem: string, 
            * subject: array{CN: string, OU: string, O: string}, 
            * extensions: array{subjectKeyIdentifier: string}}} $ca */
          $ca = parse_x509($cafile);
          foreach ($ca as $x509_cert) {
            if ($x509_cert["fingerprint"] == $cert["fingerprint"]) {
              if ($type === "rpm" || $type === "repomd" || $type === "deb" || $type === "gpg") {
                $errors[] = ["error" => ["The task type '{0}' does not support {1} certificates", $type, "X509"]];
                break 2;
              }
              if ($have_ca) {
                $errors[] = ["error" => ["The task type '{0}' only supports one root certificate", $type]];
                break 2;
              }
              if ($have_pubkey) {
                $errors[] = ["error" => ["The task type '{0}' can not include both public keys and X509 certificates", $type]];
                break 2;
              } 
              $have_ca = true;
              $certok = true;

              if ($x509_cert["subject"]["CN"])
                $certname = $x509_cert["subject"]["CN"];
              else if ($x509_cert["subject"]["OU"])
                $certname = $x509_cert["subject"]["OU"];
              else if ($x509_cert["subject"]["O"])
                $certname = $x509_cert["subject"]["O"];
              else if ($x509_cert["extensions"]["subjectKeyIdentifier"])
                $certname = $x509_cert["extensions"]["subjectKeyIdentifier"];
              else
                $certname = "";
              break;
            }
          }
        }
      }

      if ($certok)
        $certs[] = ["name" => $certname, "fingerprint" => $cert["fingerprint"]];
      else
        $errors[] = ["error" => "One of the certificates does not exist"];
    }

    if ($type === "rpm" || $type === "repomd" || $type === "gpg") {
if (count($certs) != 1)
        $errors[] = ["error" => ["The task type '{0}' requires a GPG certificate", $type]]; 
    }

    if ($type === "openssl" || $type === "cyberwatch" || $type == "deb") {
if (count($certs) < 1)
        $errors[] = ["error" => ["The task type '{0}' at least one certificate or public key", $type]]; 
    }

    if ($errors == []) {
      $nt = 0;
      foreach ($dsas->tasks->task as $task) {
        if ($task->id == $id) {
          if ($directory != $task->directory) {
            dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "tc@" . interco_haut(), "sudo", "sudo", "-u", "haut", "mv", "-n", _DSAS_HAUT . "/" . $task->directory, _DSAS_HAUT . "/" . $directory]);
            dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "tc@" . interco_haut(), "sudo", "sudo", "-u", "verif", "mv", "-n", _DSAS_BAS . "/" . $task->directory, _DSAS_BAS . "/" . $directory]);
            dsas_exec(["sudo", "sudo", "-u", "haut", "mv", "-n", _DSAS_HAUT . "/" . $task->directory, _DSAS_HAUT . "/" . $directory]);
            dsas_exec(["sudo", "sudo", "-u", "verif", "mv", "-n", _DSAS_BAS . "/" . $task->directory, _DSAS_BAS . "/" . $directory]);
          }
          while ($dsas->tasks[0]->task[$nt]->cert[0])
            unset($dsas->tasks[0]->task[$nt]->cert[0]);
          unset($dsas->tasks[0]->task[$nt]->archs[0]);
          break;
        }
        $nt++;
      }
      if ($nt === $dsas->tasks->task->count()) {
        $task = $dsas->tasks[0]->addChild("task");
        $task->id[0] = dsasid();
        $task->name[0] = $name;
      }
      $dsas->tasks[0]->task[$nt]->directory[0] = $directory;
      $dsas->tasks[0]->task[$nt]->uri[0] =  $uri;
      $dsas->tasks[0]->task[$nt]->type[0] = $type;
      $dsas->tasks[0]->task[$nt]->run[0] = $run;
      $dsas->tasks[0]->task[$nt]->ca[0]->fingerprint[0] = $ca_finger;
      $dsas->tasks[0]->task[$nt]->ca[0]->name[0] = $ca_name;
      foreach ($certs as $cert) {
        $newcert = $dsas->tasks[0]->task[$nt]->addChild("cert");
        $newcert->name[0] = $cert["name"];
        $newcert->fingerprint[0] = $cert["fingerprint"];
      }
      if ($type === "deb") {
        $newarch = $dsas->tasks[0]->task[$nt]->addChild("archs");
        foreach ($data["archs"] as $arch) {
          switch ($arch["arch"]){
            case "source":
            case "all":
            case "amd64":
            case "arm64":
            case "armel":
            case "armhf":
            case "i386":
            case "mips64el":
            case "mipsel":
            case "ppc64el":
            case "s390x":
            // Architecture ok
              if ($arch["active"] == "true")
                $newarch->addChild("arch", $arch["arch"]);
            break;
          }
        }
      }
    }
  } catch (Exception $e) {
     $errors[] = ["error" => ["Internal server error : {0}", $e->getMessage()]];
  }
  if ($dsas !== false && $errors == [])
    $dsas->asXml(_DSAS_XML);

  return $errors;
}

?>
