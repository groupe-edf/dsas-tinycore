<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else if ($_SERVER["REQUEST_METHOD"] == "POST") {
    try {
       // Protect against correupted $_FILES array
      if (!isset($_FILES["file"]["error"]) || is_array($_FILES["file"]["error"]))
        throw new RuntimeException("Invalid parameter");

      switch ($_FILES["file"]["error"]) {
        case UPLOAD_ERR_OK:
          break;
        case UPLOAD_ERR_NO_FILE:
          throw new RuntimeException("No file sent");
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
          throw new RunetimeException("Exceeded filesize limit");
        default:
          throw new RuntimeException("Unknown error");
      }

      // 100 Mo hard limit
      if ($_FILES["file"]["size"] > 100000000)
        throw new RuntimeException("Execeed filesize limit");

      // Don't trust passed mime type. Test it
      $finfo = new finfo(FILEINFO_MIME_TYPE);
      if ($finfo->file($_FILES["file"]["tmp_name"]) !== "application/gzip")
        throw new RuntimeException("Invalid file format");

      # FIXME should control the contents of the file against what is in /opt/.filetool.lst
      # and anything not allowed should e rejected. This could reduce the risk of someone
      # uploading anything they want, but they can already change /etc/shadow, /etc/passwd 
      # and the configuration of ssh. Frankly if they have admin rights on the web interface
      # of the DSAS they are alreay on the wrong side of the DSAS..

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