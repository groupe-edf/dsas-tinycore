<?php
require_once "common.php";

if (! dsas_loggedin())
  // No security risk here, trying to logout when not connected. Don't log it
  die(header("HTTP/1.0 403 Forbidden"));
else {
  $cnxstr = $_SERVER["REMOTE_ADDR"];
  if (!empty($_SERVER["HTTP_X_FORWARDED_FOR"]))
     $cnxstr = $cnxstr . " [" . $_SERVER["HTTP_X_FORWARDED_FOR"] . "]";
  else if (!empty($_SERVER["HTTP_CLIENT_IP"]))
     $cnxstr = $cnxstr . " [" . $_SERVER["HTTP_CLIENT_IP"] . "]";


  // Unset all of the session variables
  $_SESSION = array();

  // Destory the session
  session_destroy();

  syslog(LOG_NOTICE, "Succesful DSAS logout from " . $cnxstr);
  echo "ok";
}

?>
