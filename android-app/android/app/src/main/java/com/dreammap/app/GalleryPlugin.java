package com.dreammap.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * 把网页里的图片数据直接写进系统相册（Pictures/梦想地图）。
 * Android 10+ 走 MediaStore 分区存储，不需要任何权限；
 * Android 9 及以下写入公共 Pictures 目录后发一次媒体扫描。
 */
@CapacitorPlugin(name = "Gallery", permissions = {
    @Permission(alias = "storage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
})
public class GalleryPlugin extends Plugin {

  private static final String ALBUM = "梦想地图";

  @PluginMethod
  public void saveImage(PluginCall call) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
        && getPermissionState("storage") != PermissionState.GRANTED) {
      requestPermissionForAlias("storage", call, "storagePerm");
      return;
    }
    doSave(call);
  }

  @PermissionCallback
  private void storagePerm(PluginCall call) {
    if (getPermissionState("storage") == PermissionState.GRANTED) {
      doSave(call);
    } else {
      call.reject("没有写入相册的权限");
    }
  }

  private void doSave(PluginCall call) {
    String raw = call.getString("base64", "");
    String name = call.getString("name", "");
    if (raw == null || raw.length() == 0) {
      call.reject("图片数据为空");
      return;
    }
    int comma = raw.indexOf(',');
    if (comma > 0 && raw.substring(0, comma).contains("base64")) raw = raw.substring(comma + 1);
    if (name == null || name.trim().length() == 0) name = "梦想地图-" + System.currentTimeMillis() + ".jpg";

    byte[] bytes;
    try {
      bytes = Base64.decode(raw, Base64.DEFAULT);
    } catch (Exception e) {
      call.reject("图片数据解析失败");
      return;
    }

    try {
      String where = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
          ? saveModern(bytes, name)
          : saveLegacy(bytes, name);
      JSObject ret = new JSObject();
      ret.put("uri", where);
      call.resolve(ret);
    } catch (Exception e) {
      call.reject("保存失败：" + e.getMessage());
    }
  }

  private String saveModern(byte[] bytes, String name) throws Exception {
    ContentResolver cr = getContext().getContentResolver();
    ContentValues v = new ContentValues();
    v.put(MediaStore.Images.Media.DISPLAY_NAME, name);
    v.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
    v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/" + ALBUM);
    v.put(MediaStore.Images.Media.IS_PENDING, 1);

    Uri uri = cr.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
    if (uri == null) throw new Exception("无法创建相册文件");
    try (OutputStream os = cr.openOutputStream(uri)) {
      if (os == null) throw new Exception("无法写入相册文件");
      os.write(bytes);
      os.flush();
    } catch (Exception e) {
      cr.delete(uri, null, null);
      throw e;
    }
    ContentValues done = new ContentValues();
    done.put(MediaStore.Images.Media.IS_PENDING, 0);
    cr.update(uri, done, null, null);
    return uri.toString();
  }

  @SuppressWarnings("deprecation")
  private String saveLegacy(byte[] bytes, String name) throws Exception {
    File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), ALBUM);
    if (!dir.exists() && !dir.mkdirs()) throw new Exception("无法创建相册目录");
    File f = new File(dir, name);
    if (f.exists()) {
      String base = name.replaceAll("\\.[^.]+$", "");
      String ext = name.substring(base.length());
      int i = 2;
      while (f.exists()) f = new File(dir, base + "-" + i++ + ext);
    }
    try (FileOutputStream fos = new FileOutputStream(f)) {
      fos.write(bytes);
      fos.flush();
    }
    Context ctx = getContext();
    MediaScannerConnection.scanFile(ctx, new String[]{ f.getAbsolutePath() },
        new String[]{ "image/jpeg" }, null);
    return Uri.fromFile(f).toString();
  }
}
