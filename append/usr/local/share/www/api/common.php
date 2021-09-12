<?php

// FIXME : Lots of dead code here to clean up

define("_DSAS_VAR", "/var/dsas");
define("_DSAS_XML", _DSAS_VAR . "/dsas_conf.xml");

function dsas_ca_file() {
  foreach (["/etc/ssl/ca-bundle.crt", "/etc/ssl/ca-certificates.crt",
           "/usr/local/etc/ssl/ca-bundle.crt", "/ust/local/etc/ssl/ca-certificates.crt"] as $f) {
    if (is_file($f))
      return $f;
  }
  return "";
}

function dsas_loggedin() {
  // Initialize the session, ignoring uninitalised session ids
  ini_set("session.use_strict_mode", 1);
  session_start();

  // Check if the user is already logged in, if yes then redirect him to welcome p
  if(!isset($_SESSION["loggedin"]) || $_SESSION["loggedin"] !== true){
    return false;
  }

  // Check for autologout after 600 seconds
  if(time() - $_SESSION["timestamp"] > 600){
    $_SESSION = array();
    session_destroy();
    return false;
  } else{
    $_SESSION["timestamp"] = time();
    return true;
  }
}

function dsas_dir() {
  return "/home/dsas";
}

function dsas_has_dir(){
  $d = dsas_dir();
  return ((!isempty($d)) && is_dir($d));
}

function dsas_has_xml() {
  return is_file(_DSAS_XML); 
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
    foreach ($stdin as $line)
       fwrite($pipes[0], $line . PHP_EOL);
    fclose($pipes[0]);

    $stdout="";
    while (!feof($pipes[1]))
      $stdout = $stdout . fgets($pipes[1]);
    fclose($pipes[1]);
    $stderr = "";
    while (!feof($pipes[2]))
      $stderr = $stderr . fgets($pipes[2]);
    fclose($pipes[2]);
    $retval = proc_close($process);
    return ["retval" => $retval, "stdout" => $stdout, "stderr" => $stderr];
  } else {
    return ["retval" => -1];    
  }
}

function sasl_checkpass($user, $pass){
    // FIXME : I should really reimplement this using sockets like in
    //   testsasldauth.c on the Cyrus github
    // Till then use proc_open with an array to avoid spawning a shell that
    // could be attacked. The testsaslauthd command doesn't really expose
    // any parameters that could be attacked

  $descriptorspec = array(
    0 => array("pipe", "r"), // stdin
    1 => array("pipe", "w"), // stdout
    2 => array("pipe", "w") //stderr
  );

  $cwd = "/tmp";
  // Call command as an array to avoid creating a shell
  $process = proc_open(["/usr/local/sbin/testsaslauthd", "-u", $user, "-p", $pass], $descriptorspec, $pipes, $cwd);
  if (is_resource($process)) {
    fclose($pipes[0]);
    fclose($pipes[1]);
    $stderr = fgets($pipes[2]);
    fclose($pipes[2]);
    return proc_close($process);
  } else {
    return -1;    
  }
}

function complexity_test($passwd) {
   // FIXME Add more conditions
   if (strlen($passwd) < 8)
      return false;
   else
      return true;
}

function dsas_init(){
  if (!is_file(_DSAS_XML)) {
    $xml = <<< XML
<?xml version="1.0"?>
<dsas>
  <config>
    <users>
      <hash>sha512</hash>
      <first>true</first>
      <user>tc</user>
      <user>bas</user>
      <user>haut</user>
    </users>
    <network>
      <bas>
        <dhcp>true</dhcp>
        <cidr />
        <gateway />
        <dns>
          <domain />
          <nameserver />
        </dns>
      </bas>
      <haut>
        <dhcp>true</dhcp>
        <cidr />
        <gateway />
        <dns>
          <domain />
          <nameserver />
        </dns>
      </haut>
    </network>
    <web>
      <ssl>
        <countryName></countryName>
        <stateOrProvinceName></stateOrProvinceName> 
        <localityName></localityName>
        <organizationName></organizationName>
        <organizationalUnitName></organizationialUnitName>
        <commonName></commonName>
        <emailAddress></emailAddress>
        <validity></validity>
      </ssl>
      <repo>false</repo>
    </web>
    <ssh>
      <active>false</active>
      <user_tc></user_tc>
      <user_bas></user_bas>
      <user_haut></user_haut>
    </ssh>
    <ntp>
      <active>false</active>
      <server></server>
    </ntp>
    <syslog>
      <active>false</active>
      <server></server>
    </syslog>
    <disk></disk>
  </config>
  <tasks>
  </tasks>
  <certificates>
  </certificates>
</dsas>
XML;

    file_put_contents(_DSAS_XML, $xml);
  }
}

function interco_haut(){
  // FIXME Make it configurable ?
  return "192.168.192.2";
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
  
  // User proc_open with a command array to avoid spawning
  // a shell that can be attacked
  // Set the machine "haut" first as it might not be available
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
  $ret["retval"] = $retval;
  $ret["stderr"] = $stderr;
  if (! empty($retval)) {
    $ret["retval"] = $retval;
    $ret["stderr"] = $stderr;
    return $ret;
  }

  // Now set the password on the machine "bas"
  $process = proc_open(["sudo", "/usr/sbin/chpasswd", "-c", $hash], $descriptorspec, $pipes, $cwd);
  fwrite($pipes[0], $name . ":" . $passwd . PHP_EOL);
  fclose($pipes[0]);
  fclose($pipes[1]);
  $stderr = fgets($pipes[2]);
  fclose($pipes[2]);
  $retval = proc_close($process);
  return $ret;
}

function mask2cidr($mask){
  $long = ip2long($mask);
  $base = ip2long("255.255.255.255");
  return 32-log(($long ^$base)+1,2);
}

// This function should never be passed parameters from the end user
// If it ever is convert exec to use proc_open with a command array
function ip_interface($interface){  
  $pattern1 = "/inet addr:(\d+\.\d+\.\d+\.\d+)/";
  $pattern2 = "/Mask:(\d+\.\d+\.\d+\.\d+)/";     
  if (! exec(escapeshellcmd("/sbin/ifconfig " . $interface) . " 2>&1", $text, $retval)) {
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
        return "Mask est invalid.";
      $mask = intval($mask);
      if ($mask < 0 || $mask > 32)
        return "Mask est invalid.";
    } else
      return "Mask est invalid.";
  }
  $arr = explode(".", $net);
  if (count($arr) != 4)
    return "Address est invalid.";
  else {
    foreach ($arr as $value) {
      if (!is_numeric($value))
        return "Address est invalid.";
      $val = intval($value);
      if ($val < 0 || $val > 255)
        return "Address est invalid;";
    }
  }
  return "";
}

function inet_valid($addr){
  # If it starts in a number, it's an IP address
  if (is_numeric($addr[0]))
    return ip_valid($addr, true);
  else
    return (is_valid_domain($addr) ? "" : "Address est invalid");
}

function dsas_get_logs() {
  $logs = array();
  foreach (["", ".0", ".1", ".2", ".3", ".4", ".5", ".6", ".7", ".8", ".9"] as $ext) {
    if (is_file(_DSAS_VAR . "/dsas_verif.log" . $ext)) {
      if ($fp = fopen(_DSAS_VAR . "/dsas_verif.log" .$ext, "r")) {
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

function format_dsas_log($log, $hide){
  $fp = fopen($log, "r");
  $out = "";
  if ($fp){
    while (($line = fgets($fp)) !== false){
      if (substr($line,0,2) === "  ") {
        if (!$hide) $out = $out . "<span class='text-muted'>" . substr($line,0,-1) . "</span>" . PHP_EOL;
      } else
        $out = $out . "<span class='text-danger'>" . substr($line,0,-1) . "</span>" . PHP_EOL;
    }
    fclose($fp);
    return $out;
  } else
    return '<div class="alert alert-warning">Journal ' . $log . ' de DSAS pas trouv&eacute;.';
}

function format_space($bytes) {
  $symbols = array('B', 'KB', 'MB', 'GB', 'TB', 'PB');
  $exp = floor(log($bytes)/log(1000));
  return sprintf("%.2f %s", ($bytes/pow(1000, floor($exp))), $symbols[$exp]); 
}

function dsas_disk_space($device) {
  $d = substr($device, 5);
  if (trim($d, "0..9") === $d) {
    $f = "/sys/block/" . $d . "/size";
  } else {
    $f = "/sys/block/" . trim($d, "0..9") . "/" . $d . "/size";
  }
  if (is_file($f)) {
    $bytes = file_get_contents($f) * 512;
    return sprintf("%20s %s", $device, format_space($bytes));
  } else {
    return sprintf("%20s : Device not found", $device);
  }
}

function dsas_space() {
  $d = dsas_dir();
  if (is_dir ($d)) {
    $tot = format_space(disk_total_space($d));
    $fre = format_space(disk_free_space($d));
    return sprintf("Dir : %20s, Total Space : %s, Free Space : %s", $d, $tot, $fre); 
  } else {
    return sprintf("Dir : %20s, does not exist", $d);
  }
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
    preg_match("/uid\s+([^$]+)" . PHP_EOL . "/", $text, $matches); 
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

function append_simplexml(&$to, $from) {
  foreach ($from as $child) {
    $tmp = $to->addChild($child->getName(), (string) $child);
    foreach ($child->attributes() as $attr_key => $attr_value)
      $tmp->addAttribute($attr_key, $attr_value);
    append_simplexml($tmp, $child);
  }
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
 if (is_file(_DSAS_VAR . "/dsas_runlog")) {
    if ($fp = fopen(_DSAS_VAR . "/dsas_runlog", "r")) {
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
  // Protect against correupted $_FILES array
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
