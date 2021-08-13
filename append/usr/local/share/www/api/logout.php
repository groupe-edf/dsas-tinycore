<?php
require_once "common.php";

error_log("logout");

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else {
  // Unset all of the session variables
  $_SESSION = array();

  // Destory the session
  session_destroy();

  echo "ok";
}

?>
