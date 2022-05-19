<?php
require_once "common.php";

if (! dsas_loggedin(false))
  die(header("HTTP/1.0 403 Forbidden"));
else {
  header("Content-Type: application/json");
  if (empty($_GET["REFRESH_LEN"])) {
    echo json_encode(dsas_get_logs());
  } else {
    echo json_encode(dsas_get_log($_GET["REFRESH_LEN"]));
  }
}

?>