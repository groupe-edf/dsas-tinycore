<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else {
  dsas_init();
  header("Content-Type: application/json");
  echo json_encode(["has_tce" =>  dsas_has_tce(),
                    "disks" => dsas_detect_disks(),
                    "first" => force_passwd()]);
}

?>