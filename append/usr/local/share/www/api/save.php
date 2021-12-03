<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else {
  $output = dsas_exec(["/usr/bin/sudo", "/usr/bin/filetool.sh", "-b"]);
  if ($output["retval"] != 0)
    die(header("HTTP/1.0 500 Internal Server Error"));
  else
    echo "Ok";
}

?>