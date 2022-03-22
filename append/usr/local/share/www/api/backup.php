<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else if ($_SERVER["REQUEST_METHOD"] == "POST") {
    try {
      // This will throw an error in case of a problem which is caught below 
      check_files($_FILES["file"], "application/gzip");

      // The contents of the tar files is controlled in dsasbackup
      if (empty($_POST["passwd"]))
        $ret = dsas_exec(["/usr/local/sbin/dsasbackup", "-r", $_FILES["file"]["tmp_name"]]);
       else
        $ret = dsas_exec(["/usr/local/sbin/dsasbackup", "-r", $_FILES["file"]["tmp_name"], "-p", $_POST["passwd"]]);
      if ($ret["retval"] != 0)
        throw new RuntimeException($ret["stderr"]);
      echo "Ok";
    }  catch (RuntimeException $e) {
      header("Content-Type: application/json");
      echo json_encode([["restore" => ["Error during the restoration : {0}", $e->getMessage()]]]);
    }
} else {
  $BKP = "/tmp/dsasbackup.tgz";
  if (empty($_GET["passwd"]))
    $ret = dsas_exec(["/usr/local/sbin/dsasbackup", $BKP]);
  else
    $ret = dsas_exec(["/usr/local/sbin/dsasbackup", $BKP, "-p", $_GET["passwd"]]);
  if ($ret["retval"] != 0)
    die(header("HTTP/1.0 500 Internal Server Error: " . $ret["stderr"]));
  else {
    $fp = fopen($BKP, "rb");
    $backup = fread($fp, filesize($BKP));
    fclose($fp);
    header("Content-Type: application/json");
    echo base64_encode($backup);
  }
}

?>