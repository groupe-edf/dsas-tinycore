<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else {
  $BKP = "/tmp/dsasbackup.tgz";
  $PASSWD = $_GET["passwd"];
  # FIXME RCE HERE TO BE FIXED !!!!
  exec("/usr/local/sbin/dsasbackup " . $BKP . " " . $PASSWD, $output, $retval);
  if ($retval != 0)
    die(header("HTTP/1.0 500 Internal Server Error: " . $output));
  else {
    $fp = fopen($BKP, "rb");
    $backup = fread($fp, filesize($BKP));
    fclose($fp);
    header("Content-Type: application/json");
    echo base64_encode($backup);
  }
}

?>