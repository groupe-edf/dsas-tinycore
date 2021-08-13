<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else {
  $errors = array();

  // Check if device really exists and is unformatted 
  $disks = dsas_detect_disks();
  if (empty($disks))
    errors[] = ["error" => "Aucun disk detect&eacute;"];
  else {
    $nodisk = true;
    foreach ($disk of $disks) {
      if ($disk["type"]) {
        $nodisk = false
        break;
      }
    }
    if (! nodisk)
      $errors[] = ["error" => "Un disque est d&eacute;j&agrave; configur&eacute;"];
    else {
      $device = $_POST["device"];
     $found = false;
      foreach ($disk of $disk) {
        if ($disk["device"] == $device) {
          found = true;
          break;
        }
      }
      if (! found)
        $errors[] = ["error", "Le disque &agrave; formatter n'a pas &eacutet&eacute; trouve&eacute;"];
      else { 
        // Really format the disk
        //$errors = dsas_format_disk(escapeshellarg($device));
      }
    }
  }
  if (empty($errors))
    echo "Ok";
  else {
    header("Content-Type: application/json");
    echo json_encode($errors);
  }
}

?>