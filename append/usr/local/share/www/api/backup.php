<?php
/**
 *    DSAS - Tinycore
 *    Copyright (C) 2021-2022  Electricite de France
 *
 *    This program is free software; you can redistribute it and/or modify
 *    it under the terms of the GNU General Public License as published by
 *    the Free Software Foundation; either version 2 of the License, or
 *    (at your option) any later version.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU General Public License for more details.
 *
 *    You should have received a copy of the GNU General Public License along
 *    with this program; if not, write to the Free Software Foundation, Inc.,
 *    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */

require_once "common.php";

if (! dsas_loggedin())
  header("HTTP/1.0 403 Forbidden");
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
    header("HTTP/1.0 500 Internal Server Error: " . $ret["stderr"]);
  else {
    if ($fp = fopen($BKP, "rb")) {
      $backup = fread($fp, (int)filesize($BKP));
      fclose($fp);
      header("Content-Type: application/json");
      echo base64_encode((string)$backup);
    } else
      header("HTTP/1.0 500 Internal Server Error");
  }
}

?>
