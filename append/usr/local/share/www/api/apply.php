<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else {
  // exec here for now, use proc_open to avoid shell if user input is supplied
  $haut = interco_haut();

  // FIXME Can't use dsas_exec here as this command sent a HUP to the very server
  // on which this PHP code is running. So dsas_exec will hang in this case. 
  // exceptionally we use "exec" that seems to work.
  exec("sudo /etc/init.d/services/dsas apply", $dummy, $retval);
  $output["retval"] = $retval;

  if ($output["retval"] == 0) 
    $output = dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "tc@" . $haut, "cp", "/var/dsas/dsas_conf.xml", "/var/dsas/dsas_conf.xml.old"]);
  if ($output["retval"] == 0) 
    $output = dsas_exec(["sudo", "sudo", "-u", "haut", "scp", "/var/dsas/dsas_conf.xml", "tc@" . $haut . ":/tmp"]);
  if ($output["retval"] == 0) 
    $output = dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "tc@" . $haut, "mv", "/tmp/dsas_conf.xml", "/var/dsas/dsas_conf.xml"]);
  if ($output["retval"] == 0)
    $output = dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "tc@" . $haut, "sudo", "/etc/init.d/services/dsas", "apply"]);
  if ($output["retval"] != 0)
    die(header("HTTP/1.0 500 Internal Server Error: " . $output["stderr"]));
  else
    echo "Ok";
}
?>