<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else {
  // Must use exec here as dsas_exec returns an unwanted error while web server is shutting down
  exec("sudo sudo -u haut ssh tc@" . interco_haut() . " /usr/bin/sudo /sbin/reboot", $output, $retval);
  // The above will give an error is the machine haut is down. So don't test for an error
  // here before taking the machine bas down
  exec("/usr/bin/sudo /sbin/reboot", $output, $retval);
  if ($retval != 0)
    die(header("HTTP/1.0 500 Internal Server Error"));
  else
    echo "Ok";
}

?>