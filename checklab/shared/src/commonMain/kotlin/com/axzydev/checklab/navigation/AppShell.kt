package com.axzydev.checklab.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.axzydev.checklab.auth.Me
import com.axzydev.checklab.design.BentoCard
import com.axzydev.checklab.design.Brand
import com.axzydev.checklab.design.Eyebrow
import com.axzydev.checklab.design.Icon
import com.axzydev.checklab.design.Lucide
import com.axzydev.checklab.design.blobatar.BlobatarImage
import kotlinx.coroutines.launch

/** Blobatar de la persona sobre un círculo claro, como `ProfileAvatar` en la web. */
@Composable
fun Avatar(name: String, size: Int, ring: Color = Color.Transparent) {
    Box(
        Modifier.size(size.dp).clip(CircleShape).background(Brand.Paper).border(2.dp, ring, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        BlobatarImage(name, size = (size * 0.9f).dp)
    }
}

/**
 * Marco de toda la app con sesión: barra superior con el título, barra inferior con las
 * pestañas base y drawer (desde la pestaña "Menú") con el resto de secciones visibles
 * para el rol, el mismo catálogo que el menú de la web.
 */
@Composable
fun AppShell(
    me: Me,
    current: String,
    onNavigate: (String) -> Unit,
    onSignOut: () -> Unit,
    title: String,
    subtitle: String,
    unread: Int = 0,
    content: @Composable ColumnScope.() -> Unit,
) {
    val drawer = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val close: () -> Unit = { scope.launch { drawer.close() } }

    ModalNavigationDrawer(
        drawerState = drawer,
        scrimColor = Brand.Navy.copy(alpha = 0.45f),
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = Color.White,
                drawerShape = RoundedCornerShape(topEnd = 28.dp, bottomEnd = 28.dp),
                // La cabecera navy pinta detrás de la barra de estado; ella misma aplica el inset.
                windowInsets = WindowInsets(0, 0, 0, 0),
                modifier = Modifier.widthIn(max = 320.dp),
            ) {
                DrawerContent(
                    me = me,
                    current = current,
                    onSelect = { id ->
                        close()
                        if (id != current) onNavigate(id)
                    },
                    onSignOut = {
                        close()
                        onSignOut()
                    },
                )
            }
        },
    ) {
        Column(Modifier.fillMaxSize().background(Brand.Paper)) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(Color.White)
                    .statusBarsPadding()
                    .padding(start = 6.dp, end = 16.dp, top = 6.dp, bottom = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .clickable(role = Role.Button) { scope.launch { drawer.open() } },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Lucide.Menu, Brand.Navy, size = 22.dp, description = "Abrir menú")
                }
                Column(Modifier.weight(1f).padding(horizontal = 8.dp)) {
                    Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.semantics { heading() }, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (subtitle.isNotEmpty()) {
                        Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = Brand.Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                Box(Modifier.clip(CircleShape).clickable(role = Role.Button, onClickLabel = "Abrir mi perfil") { if (current != "profile") onNavigate("profile") }) {
                    Avatar(me.name, 40)
                }
            }
            Column(
                Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Column(Modifier.widthIn(max = 720.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
            }
            val tabs = bottomTabs(me)
            BottomBar(tabs, selectedTab(current, tabs), unread) { id ->
                when {
                    id == MENU_TAB -> scope.launch { drawer.open() }
                    id != current -> onNavigate(id)
                }
            }
        }
    }
}

@Composable
private fun BottomBar(tabs: List<BottomTab>, selected: String, unread: Int, onSelect: (String) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(Color.White)
            .border(1.dp, Brand.Line)
            .navigationBarsPadding()
            .padding(horizontal = 6.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceAround,
    ) {
        tabs.forEach { tab ->
            val on = tab.id == selected
            val badge = if (tab.id == "notifications" && unread > 0) unread else 0
            Column(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(14.dp))
                    .clickable(role = Role.Tab) { onSelect(tab.id) }
                    .semantics { this.selected = on }
                    .padding(vertical = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box {
                    Box(
                        Modifier
                            .size(width = 52.dp, height = 30.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(if (on) Brand.MintSoft else Color.Transparent),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(tab.icon, if (on) Brand.MintInk else Brand.Muted, size = 21.dp, description = if (badge > 0) "${tab.label}: $badge sin leer" else null)
                    }
                    if (badge > 0) {
                        Text(
                            if (badge > 99) "99+" else "$badge",
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .clip(RoundedCornerShape(999.dp))
                                .background(Brand.Rose)
                                .padding(horizontal = 5.dp),
                            color = Color.White,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
                Text(
                    tab.label,
                    color = if (on) Brand.MintInk else Brand.Muted,
                    fontSize = 11.sp,
                    fontWeight = if (on) FontWeight.Bold else FontWeight.Medium,
                    maxLines = 1,
                )
            }
        }
    }
}

@Composable
private fun DrawerContent(me: Me, current: String, onSelect: (String) -> Unit, onSignOut: () -> Unit) {
    Column(Modifier.fillMaxHeight()) {
        // Cabecera navy con la persona, como el panel de marca del login.
        Column(
            Modifier
                .fillMaxWidth()
                .background(Brush.linearGradient(listOf(Brand.Navy, Color(0xFF121822)), start = Offset.Zero, end = Offset(500f, 700f)))
                .statusBarsPadding()
                .padding(horizontal = 20.dp, vertical = 20.dp),
        ) {
            Avatar(me.name, 56, ring = Brand.Mint)
            Spacer(Modifier.height(12.dp))
            Text(me.name, color = Brand.Paper, fontWeight = FontWeight.Bold, fontSize = 17.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            val role = listOfNotNull(me.jobTitle, me.department?.name).joinToString(" · ")
            if (role.isNotEmpty()) Text(role, color = Brand.Paper.copy(alpha = 0.7f), fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(12.dp))
            Text(
                me.tenant?.name.orEmpty(),
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(Brand.Paper.copy(alpha = 0.1f))
                    .padding(horizontal = 10.dp, vertical = 5.dp),
                color = Brand.Mint,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }

        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 12.dp, vertical = 12.dp),
        ) {
            visibleMenu(me).forEachIndexed { index, section ->
                if (section.title != null) {
                    Spacer(Modifier.height(if (index == 0) 4.dp else 14.dp))
                    Text(
                        section.title.uppercase(),
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        color = Brand.Muted,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                    )
                }
                section.items.forEach { item -> DrawerItem(item, selected = item.id == current) { onSelect(item.id) } }
            }
        }

        Row(
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(12.dp)
                .clip(RoundedCornerShape(14.dp))
                .clickable(role = Role.Button, onClick = onSignOut)
                .padding(horizontal = 12.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Lucide.LogOut, Brand.Rose, size = 18.dp)
            Spacer(Modifier.width(12.dp))
            Text("Cerrar sesión", color = Brand.Rose, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, modifier = Modifier.weight(1f))
            Text("v1.0", color = Brand.Muted, fontSize = 12.sp)
        }
    }
}

@Composable
private fun DrawerItem(item: MenuItem, selected: Boolean, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 46.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(if (selected) Brand.MintSoft else Color.Transparent)
            .clickable(role = Role.Tab, onClick = onClick)
            .semantics { this.selected = selected }
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(item.icon, if (selected) Brand.MintInk else Brand.Muted, size = 18.dp)
        Spacer(Modifier.width(12.dp))
        Text(
            item.label,
            modifier = Modifier.weight(1f),
            color = if (selected) Brand.MintInk else Brand.Ink,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            fontSize = 15.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
