<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else {
  // exec here for now, use proc_open to avoid shell if user input is supplied
  $haut = interco_haut();
  exec("sudo /etc/init.d/services/dsas apply", $output, $retval);
  if ($retval == 0) 
    exec("ssh tc@" . $haut . " cp /var/dsas/dsas_conf.xml /var/dsas/dsas_conf.xml.old", $output, $retval);
  if ($retval == 0) 
    exec("scp /var/dsas/dsas_conf.xml tc@" . $haut . ":/tmp", $output, $retval);
  if ($retval == 0) 
    exec("ssh tc@" . $haut ." mv /tmp/dsas_conf.xml /var/dsas/dsas_conf.xml", $output, $retval);
  if ($retval == 0)
    exec("ssh tc@" . $haut . " sudo /etc/init.d/services/dsas apply", $output, $retval);
  if ($retval != 0)
    die(header("HTTP/1.0 500 Internal Server Error"));
  else
    echo "Ok";
}
?>