<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else {
  $dsas = simplexml_load_file(_DSAS_XML);
  $warn = array();
   
  if (force_passwd()) $warn[] =
     ["type" => "error", "msg" => "Premiere utilisation. Tous les mots de passe sont &agrave; changer."];
  if ($dsas->tasks[0]->count == 0) $warn[] = 
     ["type" => "warn", "msg" => "Aucun tache configur&eacute;."];

  header("Content-Type: application/json");
  echo json_encode($warn);
}

?>