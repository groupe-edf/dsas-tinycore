<?php
require_once "common.php";

if (! dsas_loggedin())
  header("HTTP/1.0 403 Forbidden");
else {
  $dsas = simplexml_load_file(_DSAS_XML);
  $warn = array();

  if ($dsas === false)
    $warn = ["type" => "warn", "msg" => "Error loading XML file"];
  else {
    if (force_passwd()) $warn[] =
       ["type" => "error", "msg" => "First use. All of the passwords must be changed."];
    if ($dsas->tasks->task->count() == 0) $warn[] = 
       ["type" => "warn", "msg" => "No tasks are configured."];
  }
  header("Content-Type: application/json");
  echo json_encode($warn);
}

?>
