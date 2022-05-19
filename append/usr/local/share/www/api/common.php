<?php

define("_DSAS_HOME", "/home/dsas");
define("_DSAS_HAUT", _DSAS_HOME . "/haut/share");
define("_DSAS_BAS", _DSAS_HOME . "/bas/share");
define("_DSAS_VAR", "/var/dsas");
define("_DSAS_LOG", _DSAS_HOME . "/log");
define("_DSAS_XML", _DSAS_VAR . "/dsas_conf.xml");

function dsas_ca_file() {
  foreach (["/etc/ssl/ca-bundle.crt", "/etc/ssl/ca-certificates.crt",
           "/usr/local/etc/ssl/ca-bundle.crt", "/usr/local/etc/ssl/ca-certificates.crt"] as $f) {
    if (is_file($f))
      return $f;
  }
  return "";
}

function dsas_loggedin($update_timeout = true, $admin_only = true) {
  // Initialize the session, ignoring uninitalised session ids
  ini_set("session.use_strict_mode", 1);
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

function dsas_is_admin() {
  $dsas = simplexml_load_file(_DSAS_XML);
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

function dsas_user_active($user) {
  $dsas = simplexml_load_file(_DSAS_XML);
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

function dsas_exec($args, $cwd = null, $stdin = []){
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
    stream_set_blocking($pipes[1], 0);
    stream_set_blocking($pipes[2], 0);

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
        if (feof($pipes[1])) {
          fclose($pipes[1]);
          $read_out = false;
        } else {
          $str = fgets($pipes[1]);
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
          if ($len == 0)
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
    return ["retval" => -1];    
  }
}

function dsas_checkpass($user, $pass){
    if (pam_auth($user, $pass, $error, false, "php"))
      return 0;
    else
      return -1;
}

function complexity_test($passwd) {
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

function interco_haut(){
  // Return name listed in /etc/host
  return "haut";
}

function force_passwd(){
  $dsas = simplexml_load_file(_DSAS_XML);
  if ($dsas->config->users->first == 'true')
    return true;
  return false;
}

function change_passwd($name, $passwd, $hash = "sha512"){
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

    // password and username can't be used to attack here as
    // there is no shell to attack. At this point its also too late
    // to pass args to chpasswd like "-c md5" to force a weak hash
    // So this is safe. 
    fwrite($pipes[0], $name . ":" . $passwd . PHP_EOL);
    fclose($pipes[0]);
    fclose($pipes[1]);
    $stderr = fgets($pipes[2]);
    fclose($pipes[2]);
    $retval = proc_close($process); 
    if ($retval != 0)
      return ["retval" => $retval, "stdout" => "", "stderr" => $stderr];
  }

  // Now set the password on the machine "bas"
  $process = proc_open(["sudo", "/usr/sbin/chpasswd", "-c", $hash], $descriptorspec, $pipes, $cwd);
  fwrite($pipes[0], $name . ":" . $passwd . PHP_EOL);
  fclose($pipes[0]);
  fclose($pipes[1]);
  $stderr = fgets($pipes[2]);
  fclose($pipes[2]);
  $retval = proc_close($process);
  return ["retval" => $retval, "stdout" => "", "stderr" => $stderr];
}

function mask2cidr($mask){
  $long = ip2long($mask);
  $base = ip2long("255.255.255.255");
  return 32-log(($long ^$base)+1,2);
}

function ip_interface($interface){  
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

function get_ifaces(){                                                          
  $handle = opendir("/sys/class/net");                                          
  $ifaces = array();                                                            
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
  return $ifaces;                                                               
}                                                                               

function ip_valid($addr, $nomask){
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

function inet_valid($addr){
  # If it starts in a number, it's an IP address
  if (is_numeric($addr[0]))
    return ip_valid($addr, true);
  else
    return (is_valid_domain($addr) ? "" : "The address is invalid");
}

function uri_valid($uri){
  $tmp = preg_split('!://!', $uri);
  $proto = $tmp[0];
  if (($proto != "ftp") && ($proto != "ftps") && ($proto != "sftp") && ($proto != "http") && ($proto != "https"))
    return "The protocol is invalid";
  return inet_valid(preg_split(':/:', $tmp[1])[0]);
}

function dsas_get_logs() {
  $logs = array();
  foreach (["", ".0", ".1", ".2", ".3", ".4", ".5", ".6", ".7", ".8", ".9"] as $ext) {
    if (is_file(_DSAS_LOG . "/dsas_verif.log")) {
      if ($fp = fopen(_DSAS_LOG . "/dsas_verif.log", "r")) {
        $log = array();
        while (($line = fgets($fp)) !== false){
          if (substr($line,0,2) === "  ")
            $log[] = ["type" => "normal", "line" => substr($line,0,-1)];
          else
            $log[] = ["type" => "error", "line" => substr($line,0,-1)];
        }
        fclose($fp);
        $logs[] = $log;
      }
    }
  }
  return $logs;
}

function dsas_get_log($len = 0) {
  $logs = array();
  $i = 0;

  if (is_file(_DSAS_LOG . "/dsas_verif.log" . $ext)) {
    if ($fp = fopen(_DSAS_LOG . "/dsas_verif.log" .$ext, "r")) {
      $log = array();
      while (($line = fgets($fp)) !== false){
        if ($i >= $len) {
          if (substr($line,0,2) === "  ")
            $log[] = ["type" => "normal", "line" => substr($line,0,-1)];
          else
            $log[] = ["type" => "error", "line" => substr($line,0,-1)];
        }
        $i = $i + 1;
      }
      fclose($fp);
      $logs[] = $log;
    }
  }
  return $logs;
}

function renew_web_cert($options, $days){
  foreach (array('countryName', 'stateOrProvinceName', 'localityName',
                 'organizationName', 'organizationalUnitName', 'commonName',
                 'commonName', 'emailAddress') as $key) {
    if (empty($options[$key]))
      unset($options[$key]);
    else
      $options[$key] = htmlspecialchars($options[$key]);
  }

  $privkey = openssl_pkey_new(array(
      "private_key_bits" => 2048,
      "private_key_type" => OPENSSL_KEYTYPE_RSA,
  ));

  $csr = openssl_csr_new($options, $privkey, array("digest_alg" => "sha256"));
  $x509 = openssl_csr_sign($csr, null, $privkey, $days, array("digest_alg" => "sha256"));
  openssl_csr_export($csr, $csrout);
  openssl_x509_export($x509, $certout);
  openssl_pkey_export($privkey, $pkeyout);

  return array("pub" => $certout, "priv" => $pkeyout, "csr" => $csrout);

}

function parse_x509($certfile){
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
          $tmp["fingerprint"] = openssl_x509_fingerprint($cert, "sha256");
          $tmp["pem"] = $cert;
          $certs[] = $tmp;
        }
      } else if ($incert)
        $cert = $cert . $line;
    }
    fclose($fp);
    return utf8ize($certs);
  } else
    return false; 
}

function utf8ize($d) {
  if (is_array($d)) {
    foreach ($d as $k => $v)
      $d[$k] = utf8ize($v);
  } else if (is_string ($d)) {
    return utf8_encode($d);
  }
  return $d;
}

function parse_gpg($cert){ 
  $tmp = tempnam("/tmp", "dsas_");
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
  } else
    $retval = false;                          

  unlink($tmp);
  return $retval;
}

function is_valid_domain($d){
  return (preg_match("/^([a-z\d](-*[a-z\d])*)(\.([a-z\d](-*[a-z\d])*))*$/", $d)
    && preg_match("/^.{1,253}$/", $d)
    && preg_match("/^[^\.]{1,63}(\.[^\.]{1,63})*$/", $d));
}

function dsasid($len = 24){
  if (function_exists("random_bytes")) {
    $bytes = random_bytes(ceil($len/2));
  } elseif (function_exists("openssl_random_pseudo_bytes")) {
    $bytes = openssl_random_pseudo_bytes(ceil($len/2));
  } else {
    throw new Exception("no cryptographically secure random function available");
  }
  return substr(bin2hex($bytes), 0, $len);
}

function dsas_task_running($id){
   $ret = dsas_exec(["pgrep", "-f", "$id"]);
   return ($ret["retval"] === 0);
}

function dsas_run_log($id){
 $run = dsas_task_running($id);
 if (is_file(_DSAS_LOG . "/dsas_runlog")) {
    if ($fp = fopen(_DSAS_LOG . "/dsas_runlog", "r")) {
      while (($line = fgets($fp)) !== false) {
        if ($id == substr($line,0,strlen($id))) {
           $tmp = preg_split("/\s+/", $line);
           if (count($tmp) > 2)
             return array("last" => $tmp[1], "status" => ($run ? "Running" : ($tmp[2] === "0" ? "Ok" : "Failed")));
           else
             break;
        }
      }
    }
  }
  return array("last" => "never", "status" => ($run ? "Running" : "Ok"));
}

// Check the $_FILES variable for possible attacks
function check_files($files, $mime_type){
  // Protect against corrupted $_FILES array
  if (!isset($files["error"]) || is_array($files["error"]))
    throw new RuntimeException("Invalid parameter");

  switch ($files["error"]) {
    case UPLOAD_ERR_OK:
      break;
    case UPLOAD_ERR_NO_FILE:
      throw new RuntimeException("No file sent");
    case UPLOAD_ERR_INI_SIZE:
    case UPLOAD_ERR_FORM_SIZE:
      throw new RunetimeException("Exceeded filesize limit");
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
