<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else {
  // exec is ok here as no user input
  exec("ssh tc@" . interco_haut() . " /usr/bin/sudo /sbin/reboot", $output, $retval);
  if ($retval == 0 ) exec("/usr/bin/sudo /sbin/reboot", $output, $retval);
  if ($retval != 0)
    die(header("HTTP/1.0 500 Internal Server Error"));
  else
    echo "Ok";
}

?>