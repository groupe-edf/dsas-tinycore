<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else {
  $d = dsas_dir();
  header("Content-Type: application/json");
  echo json_encode(["disk" =>  $d,
                    "free" => disk_free_space($d),
                    "total" => disk_total_space($d)]);
}

?>