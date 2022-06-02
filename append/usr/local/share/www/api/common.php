<?php

define("_DSAS_HOME", "/home/dsas");
define("_DSAS_HAUT", _DSAS_HOME . "/haut/share");
define("_DSAS_BAS", _DSAS_HOME . "/bas/share");
define("_DSAS_VAR", "/var/dsas");
define("_DSAS_LOG", _DSAS_HOME . "/log");
define("_DSAS_XML", _DSAS_VAR . "/dsas_conf.xml");

function dsas_ca_file() : string {
  foreach (["/etc/ssl/ca-bundle.crt", "/etc/ssl/ca-certificates.crt",
           "/usr/local/etc/ssl/ca-bundle.crt", "/usr/local/etc/ssl/ca-certificates.crt"] as $f) {
    if (is_file($f))
      return $f;
  }
  return "";
}

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
 * @param array<string> $args list of arguments to pass to proc_open
 * @param array<string> $stdin An array of strings representing line by line the input
 * @return array{retval: int, stdout: string, stderr: string} 
 */
function dsas_exec(array|string $args, string $cwd = null, array $stdin = []) : array {
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

function dsas_checkpass(string $user, string $pass) : bool {
    if (pam_auth($user, $pass, $error, false, "php"))
      return true;
    else
      return false;
}

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

function force_passwd() : bool {
  $dsas = simplexml_load_file(_DSAS_XML);
  if ($dsas !== false && $dsas->config->users->first == 'true')
    return true;
  return false;
}

/**
 * @return array{retval: int, stdout: string, stderr: string} 
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

function mask2cidr(string $mask) : string {
  $long = ip2long($mask);
  $base = ip2long("255.255.255.255");
  return (string)(32-log(($long ^$base)+1,2));
}

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
 * @return array<int, array{name: string, net: string}>
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

function ip_valid(string $addr, bool $nomask) : string{
  $addr = trim($addr);
  if ($nomask || empty(strpos($addr, "/"))){
    $net = $addr;
  } else {
    $arr = explode("/", $addr, 2);
    $net = $arr[0];
    $mask = $arr[1];
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

function inet_valid(string $addr) : string {
  # If it starts in a number, it's an IP address
  if (is_numeric($addr[0]))
    return ip_valid($addr, true);
  else
    return (is_valid_domain($addr) ? "" : "The address is invalid");
}

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
 * @return array<int, string> An array of log file
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

function dsas_get_log(int $len = 0, string $_file = _DSAS_LOG . "/dsas_verif.log") : string {
  $logs = "";
  if (is_file($_file)) {
    if ($fp = fopen($_file, "r")) {
      fseek($fp, $len);
      $logs = (string)fread($fp , (int)filesize($_file));
      fclose($fp);
    }
  }
  return $logs;
}

/**
 * @param array<string, string> $options
 * @return array{pub: string, priv: string, csr: string}
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
 * @param array<string, mixed> $d
 * @return array<string, mixed>
 */
function utf8ize(array $d) : array {
  foreach ($d as $k => $v)
    $d[$k] = _utf8ize($v);
  return $d;
}

/**
 * @param array<string, mixed> $d
 * @return array<string, mixed>
 */
function _utf8ize(array|string|int $d) : array|string|int {
  if (is_array($d)) {
    foreach ($d as $k => $v) {
        $d[$k] = utf8ize($v);
    }
  } else if (is_string ($d)) {
    return utf8_encode($d);
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
