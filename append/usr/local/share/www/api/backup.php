<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else if ($_SERVER["REQUEST_METHOD"] == "POST") {
    try {
      // This will throw an error in case of a problem which is caught below 
      check_files($_FILES["file"], "application/gzip");

      // FIXME should control the contents of the file against what is in /opt/.filetool.lst
      //  and anything not allowed should e rejected. This could reduce the risk of someone
      // uploading anything they want, but they can already change /etc/shadow, /etc/passwd 
      // and the configuration of ssh. Frankly if they have admin rights on the web interface
      // of the DSAS they are alreay on the wrong side of the DSAS..

      $ret = dsas_exec(["/usr/local/sbin/dsasbackup", "-r", $_FILES["file"]["tmp_name"], $_POST["passwd"]]);
      if ($ret["retval"] != 0)
        throw new RuntimeException("Error pendant la restauration : " . $ret["stderr"]);

      echo "Ok";
    }  catch (RuntimeException $e) {
      header("Content-Type: application/json");
      echo json_encode([["restore" => $e->getMessage()]]);
    }
} else {
  $BKP = "/tmp/dsasbackup.tgz";
  $ret = dsas_exec(["/usr/local/sbin/dsasbackup", $BKP, $_GET["passwd"]]);
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