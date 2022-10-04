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
 * Returns a string with the path to the A certificate bundle of the machine
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
 * this is more than 10 minutes since the last call to this function. The user is
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
 * @param string $cwd
 * @param array<string> $stdin An array of strings representing line by line the input
 * @return array{retval: int, stdout: string, stderr: string} 
 */
function dsas_exec(mixed $args, string $cwd = null, array $stdin = []) : array {
  # Simplify the call to proc_open with the means to avoids spawning a shell
  # and escaping the args integrated. The args MUST be passed as an array to get
  # the escaping to work properly.

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

    // Intercale reading of stderr and stdout to avoid one block the other
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
   // Voir https://owasp.org/www-community/password-special-characters
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
 * Return a string that can be used as the addres of the upper machine.
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
 *     The hash type to used. By default 'sha512'
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
  // installed on th emachine haut. Use proc_open with a command array to avoid spawning 
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
 * Converts a IPv4 mask like '255.255.255.0' into CIDR format, like '24'. This fnction
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
 * A function to test whether a string representatio of an IPv4 address is valid. The
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
 * Returns a string with the request part of a log file. This allow incremental download 
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
 * @return array{pub: string, priv: string, csr: string}
 *     An array with the various newly created certificates
 */
function renew_web_cert(array $options, int $days) : array {
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

  return array("pub" => $certout, "priv" => $pkeyout, "csr" => $csrout);

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
 *     "uid", "size", "keyid", "finggerprint", "created", "expires", "pem" 
 *     and "authority"
 */
function parse_gpg(string $cert) : array { 
  $retval = [];
  if ($tmp = tempnam("/tmp", "dsas_")) {
    file_put_contents($tmp, $cert);
    $data = [];
    // This use of exec is ok as there are no user parameters, the user data is passed
    // as a file $tmp
    if (exec(escapeshellcmd("/usr/local/bin/gpg -no-default-keyring -vv " . $tmp) . " 2>&1", $text, $retval)) {
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
 *   is_valid_domaine("google.com")
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
   $ret = dsas_exec(["pgrep", "-f", "$id"]);
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

?>
