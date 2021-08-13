<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else {
  // exec of here for now, use proc_open to avoid sheel if user input is supplied
  exec("/usr/local/bin/sleep 3", $output, $retval);  // FIXME put the real command here !!!
  if ($retval != 0)
    die(header("HTTP/1.0 500 Internal Server Error"));
  else
    echo "Ok";
}
?>