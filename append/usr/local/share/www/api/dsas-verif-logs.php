<?php
require_once "common.php";

if (! dsas_loggedin(false))
  header("HTTP/1.0 403 Forbidden");
else {
  header("Content-Type: application/json");
  if (! array_key_exists("REFRESH_LEN", $_GET)) {
    echo json_encode(dsas_get_logs());
  } else {
    echo json_encode(dsas_get_log($_GET["REFRESH_LEN"]));
  }
}

?>
