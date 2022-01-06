<?php
require_once "common.php";

if (! dsas_loggedin(true, false))
  die(header("HTTP/1.0 403 Forbidden"));
else if($_SERVER["REQUEST_METHOD"] == "POST"){
    $dsas = simplexml_load_file(_DSAS_XML);
    $data = json_decode($_POST["data"], true);
    $errors = array();
    if ($data["username"] != $_SESSION["username"])
      $errors[] = ["error" => ["Attempt to change password of a different user",  (string)$data["username"]]];
    else {
      $found = false;
      foreach ($dsas->config->users->user as $user) {
        if ($user->username == $data["username"]) {
          $found = true;
          $passwd = $data["passwd"];
          if ($passwd != str_replace("/\s+/", "", $passwd))
            $errors[] = [$name => "The password can not contain white spaces"];
          else if (! complexity_test($passwd))
            $errors[] = [$name => "The password is insufficently complex"];
          else {
            $ret = change_passwd($data["username"], $passwd, $dsas->config->users->hash);
            if ($ret["retval"] != 0) {
              $errors[] = [$name => $ret["stderr"]];
            } else 
              if ($user->username === "tc")
                unset($dsas->config->users->first);

              // FIXME !!!
              // To make the password change permenant across a reboot need to backup
              // /etc/shadow on both machines. Can't use 'filetool.sh -b' for this as
              // unsaved changes by an eadminstrator will also be backed up. Have to
              // untar the existing backup in tgz format, replace /etc/shadow and 
              // rearchive it. This is going to be ugly !!

              // mv /etc/sysconfig/tcedir/mydata.tgz /etc/sysconfig/tcedir/mydata.tgz.old 
              // zcat /etc/sysconfig/tcedir/mydata.tgz.old | sudo tar -Cr / etc/shadow | gzip > /etc/sysconfig/tcedir/mydata.tgz

              
            }
          }
          break;
        }
      }
      if (! $found)
        $errors[] = ["error" => ["The user '{0}' does not exist",  (string)$data["username"]]];
    }
    if ($errors == []) {
      $dsas->asXml(_DSAS_XML);
      echo "Ok";
    } else  {
      header("Content-Type: application/json");
      echo json_encode($errors);
    }
} else {
  $dsas = simplexml_load_file(_DSAS_XML);
  header("Content-Type: application/json");
  $i = 0;
  $found = false;
  foreach ($dsas->config->users->user as $user) {
    if ($user->username == $_SESSION["username"]) {
      $found = true;
      break;
    }
    $i++;
  }
  if ($found)
    echo json_encode($dsas->config->users->user[$i]);
}

?>