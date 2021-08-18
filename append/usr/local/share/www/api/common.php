<?php

// FIXME : Lots of dead code here to clean up

// Setting _DSAS_ROOT allows put dsas files elsewhere for testing
//define ("_DSAS_ROOT", "/home/tc/dsas");
define("_DSAS_ROOT", "");
define("_DSAS_XML", _DSAS_ROOT . "/var/dsas/dsas_conf.xml");

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
      <user>verif</user>
    </users>
    <network>
      <interfaces />
      <bas />
      <haut />
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

function force_passwd(){
  $dsas = simplexml_load_file(_DSAS_XML);
  if ($dsas->config->users->first == 'true')
    return true;
  return false;
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

function inet_valid($addr, $nomask){
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

function dsas_get_logs() {
  $logs = array();
  foreach (["", ".0", ".1", ".2", ".3", ".4", ".5", ".6", ".7", ".8", ".9"] as $ext) {
    if (is_file(_DSAS_ROOT . "/home/dsas/verif/verif.log" . $ext)) {
      if ($fp = fopen(_DSAS_ROOT . "/home/dsas/verif/verif.log" .$ext, "r")) {
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

function dsas_detect_disks(){

  // This use of exec is ok as no user parameters
  if (! exec("/sbin/fdisk -l | /usr/bin/awk '$1 ~ /dev/{printf \" %s \", $1}'", $fdiskl)){
    $fdiskl = array();
  }

  $devices = scandir("/sys/block/");

  $fstype = "";

  $disks = array();
  $i = $j = 0;
  foreach ($devices as $device) {
    if (($device === ".") || ($device === "..")) continue;

    if ( ! file_exists("/sys/block/" . $device ."/dev")) continue;

    $dev = file_get_contents("/sys/block/" . $device . "/dev");
    $major = substr($dev, 0, strpos($dev, ":"));
    if ($major !== "8") continue;

    foreach ($fdiskl as $part){
      if (str_contains($part, "/dev/" . $device)){
        // This use of exec is ok as no user parameters
        if (! exec("/usr/sbin/fstype " . $part, $fstype)) continue;
        if (! empty($fstype)) {
          $disks[$i]["device"] = trim($part);
          $disks[$i]["type"] = $fstype[0];
          $disks[$i]["space"] = dsas_disk_space($part);
          $i++;
        }
      }
    }

    if ($i === $j){
      $disks[$i]["device"] = "/dev/$device1";
      $disks[$i]["type"] = "";
      $disks[$i]["space"] = dsas_disk_space("/dev/$device1");
      $i++;
      $j++;
    }
  }

  return $disks;
}

function dsas_format_disk($device){
  // Ok, we have an uninitialised disk. Partition and format it
  $descriptorspec = array(
    0 => array("pipe", "r"), // stdin
    1 => array("pipe", "w"), // stdout
    2 => array("pipe", "w") //stderr
  );

  $cwd = "/tmp";
  // Call command as an array to avoid creating a shell
  $process = proc_open(["/sbin/fdisk", $device], $descriptorspec, $pipes, $cwd);

  if (is_resource($process)) {
    fwrite($pipes[0], 'n\n');
    fwrite($pipes[0], 'p\n');
    fwrite($pipes[0], '1\n');
    fwrite($pipes[0], '\n');
    fwrite($pipes[0], '\n');
    fwrite($pipes[0], 'w\n');
    fclose($pipes[0]);
    //echo stream_get_contents($pipes[1]);
    fclose($pipes[1]);
    $stderr = fgets($pipes[2]);
    fclose($pipes[2]);

    $retval = proc_close($process);
    if ($retval === 0){
      $ret = array();
    } else {
      $ret["retval"] = $retval;
      $ret["stderr"] = $stderr;
    }
  } else {
    $ret["retval"] = -1;
    $ret["stderr"] = "Erreur inconnu pendant la partionnement";
  }

  if (!empty($ret))
    return $ret;
  
  // even though the $device should have been checked that it corresponds to a real
  // device, there is user input here, so use proc_open with an array to avoid
  // creating a shell that could be attacked 
  $process = proc_open(["/sbin/mkfs.ext4", $device], $descriptorspec, $pipes, $cwd);
  if (is_resource($process)) {
    fclose($pipes[0]);
    fclose($pipes[1]);
    $stderr = fgets($pipes[2]);
    fclose($pipes[2]);
    $retval = proc_close($process);
    if ($retval === 0)
      $ret = array();
    else {
      $ret["retval"] = $retval;
      $ret["stderr"] = $stderr;
    }
  } else {
    $ret["retval"] = -1;
    $ret["stderr"] = "Erreur inconnu pendant la formattage";
  }

  return $ret;
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
      "private_key_bits" => 2038,
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
          // We need subjectKeyIdentifier to be set to allow us to identifier the certificate
          // if it isn't set, dump the certificatie.
          if (array_key_exists("extensions", $tmp) &&
              array_key_exists("subjectKeyIdentifier", $tmp["extensions"])) {
            $tmp["pem"] = $cert;
            $certs[] = $tmp;
          }
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
  if (exec(escapeshellcmd("/usr/local/bin/gpg -vv " . $tmp) . " 2>&1", $text, $retval)) {
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

?>
